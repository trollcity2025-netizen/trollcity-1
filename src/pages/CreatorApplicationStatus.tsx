import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function CreatorApplicationStatus() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadApplicationStatus();
  }, []);

  const loadApplicationStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setApplication(data);
    } catch (error) {
      console.error('Error loading application status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadApplicationStatus();
    setRefreshing(false);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading application status...</span>
        </div>
      </div>
    );
  }

  // No application found
  if (!application) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-950/60 border-slate-800 max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-50 mb-2">No Application Found</h2>
            <p className="text-slate-300 mb-4">
              You haven't submitted a creator application yet.
            </p>
            <Button 
              onClick={() => navigate('/creator-application')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Submit Application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Status configurations
  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      title: 'Application Pending',
      description: 'Your application is under review by our team.',
      action: null
    },
    approved: {
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      title: 'Application Approved!',
      description: 'Congratulations! Your creator application has been approved.',
      action: {
        label: 'Go to Creator Dashboard',
        onClick: () => navigate('/profile'),
        variant: 'default'
      }
    },
    denied: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      title: 'Application Denied',
      description: 'Unfortunately, your creator application was not approved.',
      action: {
        label: 'Submit New Application',
        onClick: () => navigate('/creator-application'),
        variant: 'outline'
      }
    }
  };

  const config = statusConfig[application.status];
  const StatusIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="border-slate-600 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-slate-50">Application Status</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-slate-600 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Main Status Card */}
        <Card className="bg-slate-950/60 border-slate-800 mb-6">
          <CardContent className="p-8">
            <div className="text-center">
              <div className={`w-20 h-20 ${config.bg} ${config.border} border-2 rounded-full flex items-center justify-center mx-auto mb-6`}>
                <StatusIcon className={`w-10 h-10 ${config.color}`} />
              </div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">{config.title}</h2>
              <p className="text-slate-300 mb-6">{config.description}</p>
              
              <Badge 
                variant="outline" 
                className={`text-sm px-4 py-2 ${
                  application.status === 'approved' 
                    ? 'border-green-500 text-green-400' 
                    : application.status === 'denied'
                    ? 'border-red-500 text-red-400'
                    : 'border-yellow-500 text-yellow-400'
                }`}
              >
                {application.status.toUpperCase()}
              </Badge>

              {config.action && (
                <div className="mt-6">
                  <Button
                    onClick={config.action.onClick}
                    className={
                      config.action.variant === 'default' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-slate-600 text-slate-300'
                    }
                  >
                    {config.action.label}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Application Details */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-400">Category</label>
                <p className="text-slate-200 capitalize">{application.category.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400">Submitted</label>
                <p className="text-slate-200">
                  {new Date(application.submitted_at).toLocaleString()}
                </p>
              </div>
              {application.reviewed_at && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Reviewed</label>
                  <p className="text-slate-200">
                    {new Date(application.reviewed_at).toLocaleString()}
                  </p>
                </div>
              )}
              {application.reviewer_notes && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Reviewer Notes</label>
                  <div className="bg-slate-800/50 p-3 rounded-lg mt-1">
                    <p className="text-slate-200 text-sm">{application.reviewer_notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Content */}
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50">Your Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-400">Streaming Experience</label>
                <div className="bg-slate-800/50 p-3 rounded-lg mt-1">
                  <p className="text-slate-200 text-sm whitespace-pre-wrap">{application.experience_text}</p>
                </div>
              </div>
              
              {application.social_links && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Social Links</label>
                  <div className="bg-slate-800/50 p-3 rounded-lg mt-1">
                    <p className="text-slate-200 text-sm whitespace-pre-wrap">{application.social_links}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-slate-400">Goals & Objectives</label>
                <div className="bg-slate-800/50 p-3 rounded-lg mt-1">
                  <p className="text-slate-200 text-sm whitespace-pre-wrap">{application.goals_text}</p>
                </div>
              </div>

              {application.empire_partner_request && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Empire Partner Request</label>
                  <Badge variant="outline" className="border-purple-500 text-purple-400 mt-1">
                    Requested
                  </Badge>
                  {application.empire_partner_reason && (
                    <div className="bg-slate-800/50 p-3 rounded-lg mt-2">
                      <p className="text-slate-200 text-sm whitespace-pre-wrap">{application.empire_partner_reason}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Next Steps for Pending Applications */}
        {application.status === 'pending' && (
          <Card className="bg-slate-950/60 border-slate-800 mt-6">
            <CardHeader>
              <CardTitle className="text-slate-50">What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-slate-300">
                <p>• Our team will review your application within 2-3 business days</p>
                <p>• We'll evaluate your streaming experience and goals</p>
                <p>• If applying for Empire Partner status, we'll assess your management capabilities</p>
                <p>• You'll receive an email notification once the review is complete</p>
                <p>• Approved creators will gain access to TrollTract benefits and earnings</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Information */}
        <Card className="bg-slate-950/60 border-slate-800 mt-6">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-50 mb-2">Need Help?</h3>
              <p className="text-slate-300 mb-4">
                If you have questions about your application, please contact our support team.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate('/support')}
                className="border-slate-600 text-slate-300"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}