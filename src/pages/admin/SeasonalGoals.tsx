import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Calendar, Plus, Edit2, CheckCircle, Trophy } from 'lucide-react';

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface TaskTemplate {
  id: string;
  metric: string;
  cadence: string;
  default_threshold: number;
  description: string;
}

interface SeasonTask {
  id: string;
  season_id: string;
  template_id: string;
  threshold: number;
  template?: TaskTemplate;
}

const SeasonalGoals = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSeasonTasks, setActiveSeasonTasks] = useState<SeasonTask[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [seasonsRes, templatesRes] = await Promise.all([
        supabase.from('task_seasons').select('*').order('start_date', { ascending: false }),
        supabase.from('task_templates').select('*').order('metric', { ascending: true })
      ]);

      if (seasonsRes.error) throw seasonsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      setSeasons(seasonsRes.data || []);
      setTemplates(templatesRes.data || []);

      const activeSeason = seasonsRes.data?.find(s => s.is_active);
      if (activeSeason) {
        const { data: tasks, error: tasksError } = await supabase
          .from('season_tasks')
          .select('*, template:task_templates(*)')
          .eq('season_id', activeSeason.id);
        
        if (!tasksError) setActiveSeasonTasks(tasks || []);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load seasonal data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSeasonActive = async (id: string, currentStatus: boolean) => {
    try {
      if (!currentStatus) {
        // Deactivate all others if activating this one
        await supabase.from('task_seasons').update({ is_active: false }).neq('id', id);
      }
      
      const { error } = await supabase
        .from('task_seasons')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Season ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const createSeason = async () => {
    const name = prompt('Season Name? (e.g. "Spring 2026")');
    if (!name) return;

    try {
      const { error } = await supabase.from('task_seasons').insert([{
        name,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        is_active: false
      }]);

      if (error) throw error;
      toast.success('Season created');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading Seasonal Goals...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <h1 className="text-3xl font-bold">Seasonal Goal System</h1>
        </div>
        <button 
          onClick={createSeason}
          className="bg-troll-green text-troll-purple-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-troll-green-dark"
        >
          <Plus className="w-5 h-5" /> New Season
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Seasons List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" /> Seasons
          </h2>
          {seasons.map(season => (
            <div 
              key={season.id} 
              className={`p-4 rounded-lg border ${season.is_active ? 'border-troll-green bg-troll-green/10' : 'border-purple-700/50 bg-black/40'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg">{season.name}</h3>
                <button 
                  onClick={() => toggleSeasonActive(season.id, season.is_active)}
                  className={`px-2 py-1 rounded text-xs font-bold ${season.is_active ? 'bg-troll-green text-black' : 'bg-gray-700 text-gray-300'}`}
                >
                  {season.is_active ? 'ACTIVE' : 'INACTIVE'}
                </button>
              </div>
              <p className="text-sm text-gray-400">
                {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Active Season Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-troll-green" /> Active Season Tasks
          </h2>
          {activeSeasonTasks.length === 0 ? (
            <div className="p-8 text-center bg-black/40 rounded-lg border border-purple-700/50 text-gray-500">
              No tasks configured for the active season.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSeasonTasks.map(task => (
                <div key={task.id} className="p-4 rounded-lg bg-black/60 border border-purple-700/70">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-troll-gold font-bold uppercase text-xs tracking-wider">
                      {task.template?.metric.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{task.template?.cadence}</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {task.threshold}
                  </div>
                  <p className="text-sm text-gray-400">{task.template?.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Task Templates (Admin reference) */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" /> Task Templates
            </h2>
            <div className="bg-black/40 rounded-lg border border-purple-700/50 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-purple-900/30 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Cadence</th>
                    <th className="px-4 py-3">Default</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {templates.map(template => (
                    <tr key={template.id} className="border-t border-purple-700/30">
                      <td className="px-4 py-3 font-mono text-blue-300">{template.metric}</td>
                      <td className="px-4 py-3">{template.cadence}</td>
                      <td className="px-4 py-3">{template.default_threshold}</td>
                      <td className="px-4 py-3 text-gray-400">{template.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonalGoals;
