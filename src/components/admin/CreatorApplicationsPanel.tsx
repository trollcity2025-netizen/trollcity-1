import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, Eye, User, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function CreatorApplicationsPanel() {
  interface CreatorApplication {
    id: string;
    status: 'pending' | 'approved' | 'denied' | string;
    display_name?: string;
    username?: string;
    category: string;
    submitted_at: string;
    empire_partner_request?: boolean;
    reviewer_notes?: string;
    experience_text?: string;
    social_links?: string;
    goals_text?: string;
    empire_partner_reason?: string;
  }
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState<CreatorApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  type FilterStatus = 'all' | 'pending' | 'approved' | 'denied';
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_creator_applications');
      if (error) {
        console.error('Error fetching creator applications:', error);
        return;
      }
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (applicationId: string, status: 'approved' | 'denied') => {
    if (!reviewNotes.trim()) {
      alert('Please provide review notes.');
      return;
    }

    try {
      setReviewing(true);
      const { error } = await supabase.rpc('review_creator_application', {
        p_application_id: applicationId,
        p_status: status,
        p_reviewer_notes: reviewNotes,
      });
      if (error) {
        throw error;
      }
      await loadApplications();
      setSelectedApplication(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error reviewing application:', error);
      alert('Failed to review application. Please try again.');
    } finally {
      setReviewing(false);
    }
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusConfig = (status: 'pending' | 'approved' | 'denied') => {
    const configs: Record<'pending' | 'approved' | 'denied', { icon: any; color: string; bg: string; border: string }> = {
      pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
      approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' },
      denied: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' }
    };
    return configs[status] || configs.pending;
  };

  if (loading) {
    return (
      <Card className="bg-slate-950/60 border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading applications...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-slate-950/60 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-50">
            Creator Applications
            <Badge variant="outline" className="text-xs">
              {applications.length} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            {(['all', 'pending', 'approved', 'denied'] as FilterStatus[]).map((status) => (
              <Button
                key={status}
                variant={filter === status ? 'default' : 'outline'}
                size="sm"
                disabled={false}
                onClick={() => setFilter(status)}
                className={
                  filter === status 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'border-slate-600 text-slate-300'
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {applications.filter(app => app.status === status).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <Card className="bg-slate-950/60 border-slate-800">
          <CardContent className="p-6 text-center">
            <p className="text-slate-400">No applications found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredApplications.map((application) => {
            const statusConfig = getStatusConfig(application.status as 'pending' | 'approved' | 'denied');
            const StatusIcon = statusConfig.icon;
            
            return (
              <Card key={application.id} className="bg-slate-950/60 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-slate-200">
                            {application.display_name || application.username || 'Unknown User'}
                          </span>
                          {application.username && (
                            <span className="text-slate-400">@{application.username}</span>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.border} border`}>
                          <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
                          <span className={`text-xs font-medium ${statusConfig.color}`}>
                            {application.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Category:</span>
                          <span className="ml-2 text-slate-200 capitalize">
                            {application.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Submitted:</span>
                          <span className="ml-2 text-slate-200">
                            {new Date(application.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        {application.empire_partner_request && (
                          <div className="md:col-span-2">
                            <Badge variant="outline" className="border-purple-500 text-purple-400">
                              Empire Partner Requested
                            </Badge>
                          </div>
                        )}
                      </div>

                      {application.reviewer_notes && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                          <p className="text-sm text-slate-300">
                            <strong>Review Notes:</strong> {application.reviewer_notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={false}
                        onClick={() => setSelectedApplication(application)}
                        className="border-slate-600 text-slate-300"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-slate-950 border-slate-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-slate-50">
                <span>Review Application</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={false}
                  onClick={() => {
                    setSelectedApplication(null);
                    setReviewNotes('');
                  }}
                  className="border-slate-600 text-slate-300"
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Applicant Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">Applicant</label>
                  <p className="text-slate-200">
                    {selectedApplication.display_name || selectedApplication.username || 'Unknown'}
                  </p>
                  {selectedApplication.username && (
                    <p className="text-slate-400 text-sm">@{selectedApplication.username}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Category</label>
                  <p className="text-slate-200 capitalize">
                    {selectedApplication.category.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Submitted</label>
                  <p className="text-slate-200">
                    {new Date(selectedApplication.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Empire Partner</label>
                  <p className="text-slate-200">
                    {selectedApplication.empire_partner_request ? 'Requested' : 'Not Requested'}
                  </p>
                </div>
              </div>

              {/* Application Content */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Streaming Experience
                  </label>
                  <div className="bg-slate-800/50 p-4 rounded-lg mt-1">
                    <p className="text-slate-200 whitespace-pre-wrap">{selectedApplication.experience_text}</p>
                  </div>
                </div>

                {selectedApplication.social_links && (
                  <div>
                    <label className="text-sm font-medium text-slate-400">Social Links</label>
                    <div className="bg-slate-800/50 p-4 rounded-lg mt-1">
                      <p className="text-slate-200 whitespace-pre-wrap">{selectedApplication.social_links}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-slate-400">Goals & Objectives</label>
                  <div className="bg-slate-800/50 p-4 rounded-lg mt-1">
                    <p className="text-slate-200 whitespace-pre-wrap">{selectedApplication.goals_text}</p>
                  </div>
                </div>

                {selectedApplication.empire_partner_request && selectedApplication.empire_partner_reason && (
                  <div>
                    <label className="text-sm font-medium text-slate-400">Empire Partner Reason</label>
                    <div className="bg-slate-800/50 p-4 rounded-lg mt-1">
                      <p className="text-slate-200 whitespace-pre-wrap">{selectedApplication.empire_partner_reason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Review Form */}
              <div className="border-t border-slate-700 pt-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Review Notes *
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide feedback on this application..."
                  rows={4}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                
                <div className="flex gap-4 mt-6">
                  <Button
                    onClick={() => handleReview(selectedApplication.id, 'approved')}
                    disabled={reviewing || !reviewNotes.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {reviewing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve Application
                  </Button>
                  <Button
                    onClick={() => handleReview(selectedApplication.id, 'denied')}
                    disabled={reviewing || !reviewNotes.trim()}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {reviewing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Deny Application
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
