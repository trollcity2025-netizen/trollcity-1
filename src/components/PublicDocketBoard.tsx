import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Scale, Calendar, Clock, Users } from 'lucide-react';

interface PublicDocketEntry {
  case_type: string;
  scheduled_at: string;
  status: string;
}

const PublicDocketBoard: React.FC = () => {
  const [docketEntries, setDocketEntries] = useState<PublicDocketEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicDocket();
    // Refresh every 5 minutes
    const interval = setInterval(loadPublicDocket, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadPublicDocket = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_public_docket_board');

      if (error) throw error;
      setDocketEntries(data || []);
    } catch (error) {
      console.error('Error loading public docket:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getCaseTypeDisplay = (caseType: string) => {
    switch (caseType) {
      case 'violation':
        return 'Community Violation';
      case 'appeal':
        return 'Appeal Hearing';
      case 'complaint':
        return 'Formal Complaint';
      default:
        return 'Court Case';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'text-blue-400 bg-blue-900/20';
      case 'in_session':
        return 'text-yellow-400 bg-yellow-900/20 animate-pulse';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-purple-500/20 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-6 h-6 text-purple-400" />
        <div>
          <h3 className="text-xl font-bold">Public Court Docket</h3>
          <p className="text-sm text-gray-400">Scheduled court proceedings (anonymized)</p>
        </div>
      </div>

      {docketEntries.length === 0 ? (
        <div className="text-center py-8">
          <Scale className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No court cases scheduled</p>
          <p className="text-sm text-gray-500 mt-1">The docket is currently clear</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docketEntries.map((entry, index) => {
            const { date, time } = formatDateTime(entry.scheduled_at);

            return (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-gray-700 rounded-lg hover:border-purple-500/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div className="text-sm">
                      <div className="font-medium">{date}</div>
                      <div className="text-gray-400">{time}</div>
                    </div>
                  </div>

                  <div className="text-sm font-medium">
                    {getCaseTypeDisplay(entry.case_type)}
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(entry.status)}`}>
                  {entry.status === 'in_session' ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                      In Session
                    </div>
                  ) : (
                    'Scheduled'
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-300">Court Transparency</span>
        </div>
        <p className="text-xs text-gray-400">
          This public docket shows scheduled court proceedings without revealing participant identities.
          All cases are handled fairly and transparently in accordance with Troll City law.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="text-lg font-bold text-blue-400">
            {docketEntries.filter(e => e.status === 'scheduled').length}
          </div>
          <div className="text-xs text-blue-300">Scheduled Cases</div>
        </div>
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <div className="text-lg font-bold text-yellow-400">
            {docketEntries.filter(e => e.status === 'in_session').length}
          </div>
          <div className="text-xs text-yellow-300">In Session</div>
        </div>
      </div>
    </div>
  );
};

export default PublicDocketBoard;