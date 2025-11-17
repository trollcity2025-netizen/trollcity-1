import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { toast } from 'sonner';

export function SafetyDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [stats, setStats] = useState({
    totalIncidents: 0,
    emergencyIncidents: 0,
    resolvedIncidents: 0,
    pendingIncidents: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  useEffect(() => {
    fetchSafetyData();
    
    // Subscribe to real-time safety incidents
    const subscription = supabase
      .channel('safety_incidents')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'safety_incidents' 
      }, (payload) => {
        console.log('Safety incident update:', payload);
        fetchSafetyData();
        
        // Show toast notification for new high-severity incidents
        if (payload.eventType === 'INSERT' && payload.new.severity_level >= 4) {
          toast.error(`🚨 SAFETY ALERT: ${payload.new.severity_level === 5 ? 'EMERGENCY' : 'HIGH RISK'} incident detected!`);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSafetyData = async () => {
    try {
      setLoading(true);
      
      // Fetch incidents
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('safety_incidents')
        .select(`*`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (incidentsError) throw incidentsError;

      // Fetch active keywords
      const { data: keywordsData, error: keywordsError } = await supabase
        .from('safety_keywords')
        .select('*')
        .eq('is_active', true)
        .order('severity_level', { ascending: false });

      if (keywordsError) throw keywordsError;

      // Calculate statistics
      const totalIncidents = incidentsData?.length || 0;
      const emergencyIncidents = incidentsData?.filter(i => i.is_emergency).length || 0;
      const resolvedIncidents = incidentsData?.filter(i => i.resolved_at).length || 0;
      const pendingIncidents = totalIncidents - resolvedIncidents;

      setIncidents(incidentsData || []);
      setKeywords(keywordsData || []);
      setStats({
        totalIncidents,
        emergencyIncidents,
        resolvedIncidents,
        pendingIncidents
      });

    } catch (error) {
      console.error('Error fetching safety data:', error);
      toast.error('Failed to load safety data');
    } finally {
      setLoading(false);
    }
  };

  const resolveIncident = async (incidentId, resolutionNotes) => {
    try {
      const { error } = await supabase
        .from('safety_incidents')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolution_notes: resolutionNotes
        })
        .eq('id', incidentId);

      if (error) throw error;

      toast.success('Incident resolved successfully');
      fetchSafetyData();
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast.error('Failed to resolve incident');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 5: return 'bg-red-600 text-white';
      case 4: return 'bg-orange-600 text-white';
      case 3: return 'bg-yellow-600 text-black';
      case 2: return 'bg-blue-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'self_harm': return 'bg-red-100 text-red-800';
      case 'violence': return 'bg-orange-100 text-orange-800';
      case 'substance_abuse': return 'bg-yellow-100 text-yellow-800';
      case 'harassment': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Safety Dashboard</h1>
        <Button 
          onClick={fetchSafetyData}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          Refresh Data
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0f0f15] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="text-white">Total Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{stats.totalIncidents}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f15] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="text-white">Emergency Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.emergencyIncidents}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f15] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="text-white">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.resolvedIncidents}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f15] border-[#2a2a3a]">
          <CardHeader>
            <CardTitle className="text-white">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-400">{stats.pendingIncidents}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Keywords */}
      <Card className="bg-[#0f0f15] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="text-white">Active Safety Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {keywords.map(keyword => (
              <Badge 
                key={keyword.id} 
                className={getSeverityColor(keyword.severity_level)}
              >
                {keyword.keyword} ({keyword.severity_level})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      <Card className="bg-[#0f0f15] border-[#2a2a3a]">
        <CardHeader>
          <CardTitle className="text-white">Recent Safety Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <p className="text-gray-400">No safety incidents recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2a2a3a]">
                    <TableHead className="text-gray-300">Time</TableHead>
                    <TableHead className="text-gray-300">User</TableHead>
                    <TableHead className="text-gray-300">Keyword</TableHead>
                    <TableHead className="text-gray-300">Category</TableHead>
                    <TableHead className="text-gray-300">Severity</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map(incident => (
                    <TableRow key={incident.id} className="border-[#2a2a3a] hover:bg-[#1a1a25]">
                      <TableCell className="text-white">
                        {new Date(incident.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-white">
                        {incident.user?.email || 'Unknown User'}
                      </TableCell>
                      <TableCell className="text-white">
                        {incident.keyword?.keyword || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(incident.keyword?.category)}>
                          {incident.keyword?.category || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(incident.severity_level)}>
                          Level {incident.severity_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {incident.resolved_at ? (
                          <Badge className="bg-green-600 text-white">Resolved</Badge>
                        ) : incident.is_emergency ? (
                          <Badge className="bg-red-600 text-white animate-pulse">🚨 EMERGENCY</Badge>
                        ) : (
                          <Badge className="bg-yellow-600 text-black">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedIncident(incident);
                              setShowIncidentModal(true);
                            }}
                            className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                          >
                            View
                          </Button>
                          {!incident.resolved_at && (
                            <Button
                              size="sm"
                              onClick={() => resolveIncident(incident.id, 'Incident reviewed and appropriate action taken')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail Modal */}
      {showIncidentModal && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-[#0f0f15] border-[#2a2a3a] max-w-2xl w-full mx-4">
            <CardHeader>
              <CardTitle className="text-white">Incident Details</CardTitle>
              <Button
                variant="ghost"
                onClick={() => setShowIncidentModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-gray-400">Context:</label>
                <p className="text-white bg-[#1a1a25] p-3 rounded">{selectedIncident.context_text}</p>
              </div>
              
              {selectedIncident.location_latitude && (
                <div>
                  <label className="text-gray-400">Location:</label>
                  <p className="text-white">
                    {selectedIncident.location_latitude}, {selectedIncident.location_longitude}
                  </p>
                </div>
              )}

              {selectedIncident.video_clip_url && (
                <div>
                  <label className="text-gray-400">Video Clip:</label>
                  <video 
                    src={selectedIncident.video_clip_url} 
                    controls 
                    className="w-full max-h-64"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    resolveIncident(selectedIncident.id, 'Incident reviewed and appropriate action taken');
                    setShowIncidentModal(false);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!!selectedIncident.resolved_at}
                >
                  {selectedIncident.resolved_at ? 'Already Resolved' : 'Mark as Resolved'}
                </Button>
                <Button
                  onClick={() => setShowIncidentModal(false)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}