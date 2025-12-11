import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface FormErrors {
  experienceText?: string;
  goalsText?: string;
  empirePartnerReason?: string;
}

export function CreatorApplication() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    experienceText: '',
    socialLinks: '',
    goalsText: '',
    empirePartnerRequest: false,
    empirePartnerReason: '',
    category: 'broadcaster'
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    loadUserStatus();
  }, []);

  const loadUserStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: application, error } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setApplicationStatus(application);

      // Pre-fill form if application exists
      if (application) {
        setFormData({
          experienceText: application.experience_text || '',
          socialLinks: application.social_links || '',
          goalsText: application.goals_text || '',
          empirePartnerRequest: application.empire_partner_request || false,
          empirePartnerReason: application.empire_partner_reason || '',
          category: application.category || 'broadcaster'
        });
      }
    } catch (error) {
      console.error('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    
    if (!formData.experienceText.trim()) {
      newErrors.experienceText = 'Streaming experience is required';
    }
    
    if (!formData.goalsText.trim()) {
      newErrors.goalsText = 'Goals are required';
    }
    
    if (formData.empirePartnerRequest && !formData.empirePartnerReason.trim()) {
      newErrors.empirePartnerReason = 'Empire Partner reason is required when applying for partnership';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          experience_text: formData.experienceText,
          social_links: formData.socialLinks,
          goals_text: formData.goalsText,
          empire_partner_request: formData.empirePartnerRequest,
          empire_partner_reason: formData.empirePartnerReason,
          category: formData.category,
          status: 'pending',
        });

      if (error) throw error;

      navigate('/creator-application/status');
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
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


  // Show existing application status
  if (applicationStatus && applicationStatus.status !== 'pending') {
    const statusConfig = {
      approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
      denied: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' }
    };
    
    const config = statusConfig[applicationStatus.status];
    const StatusIcon = config.icon;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-950/60 border-slate-800 max-w-md">
          <CardContent className="p-6 text-center">
            <div className={`w-16 h-16 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <StatusIcon className={`w-8 h-8 ${config.color}`} />
            </div>
            <h2 className="text-xl font-bold text-slate-50 mb-2">
              Application {applicationStatus.status === 'approved' ? 'Approved' : 'Denied'}
            </h2>
            <Badge 
              variant="outline" 
              className={`mb-4 ${
                applicationStatus.status === 'approved' 
                  ? 'border-green-500 text-green-400' 
                  : 'border-red-500 text-red-400'
              }`}
            >
              {applicationStatus.status}
            </Badge>
            {applicationStatus.reviewer_notes && (
              <div className="bg-slate-800/50 p-3 rounded-lg mb-4">
                <p className="text-sm text-slate-300">
                  <strong>Reviewer Notes:</strong><br />
                  {applicationStatus.reviewer_notes}
                </p>
              </div>
            )}
            {applicationStatus.status === 'denied' && (
              <Button 
                onClick={() => setApplicationStatus(null)}
                variant="outline"
                className="border-slate-600 text-slate-300"
              >
                Submit New Application
              </Button>
            )}
            {applicationStatus.status === 'approved' && (
              <div className="space-y-2">
                <Button
                  onClick={() => navigate('/profile')}
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                >
                  Go to Creator Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show pending application status
  if (applicationStatus && applicationStatus.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-950/60 border-slate-800 max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-50 mb-2">Application Pending</h2>
            <p className="text-slate-300 mb-4">
              Your creator application is under review. You'll be notified once it's processed.
            </p>
            <Button 
              onClick={() => navigate('/creator-application/status')}
              variant="outline"
              className="border-slate-600 text-slate-300"
            >
              View Application Status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show application form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">Creator Application</h1>
          <p className="text-slate-300">
            Apply to become an approved creator and unlock TrollTract benefits
          </p>
        </div>

        <Card className="bg-slate-950/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Application Form</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Streaming Experience */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Streaming Experience *
                </label>
                <textarea
                  name="experienceText"
                  value={formData.experienceText}
                  onChange={handleInputChange}
                  placeholder="Tell us about your streaming experience, platforms you've used, and your content style..."
                  rows={4}
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.experienceText ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {errors.experienceText && (
                  <p className="text-red-400 text-sm mt-1">{errors.experienceText}</p>
                )}
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Social Media Links
                </label>
                <textarea
                  name="socialLinks"
                  value={formData.socialLinks}
                  onChange={handleInputChange}
                  placeholder="Provide links to your social media profiles, other streaming platforms, etc..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Goals & Objectives *
                </label>
                <textarea
                  name="goalsText"
                  value={formData.goalsText}
                  onChange={handleInputChange}
                  placeholder="What are your goals as a creator? What do you hope to achieve on our platform?"
                  rows={4}
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    errors.goalsText ? 'border-red-500' : 'border-slate-600'
                  }`}
                />
                {errors.goalsText && (
                  <p className="text-red-400 text-sm mt-1">{errors.goalsText}</p>
                )}
              </div>

              {/* Empire Partner Request */}
              <div className="border-t border-slate-700 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    name="empirePartnerRequest"
                    checked={formData.empirePartnerRequest}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-purple-600 bg-slate-800 border-slate-600 rounded focus:ring-purple-500"
                  />
                  <label className="text-sm font-medium text-slate-300">
                    Apply to become an Empire Partner as well
                  </label>
                </div>

                {formData.empirePartnerRequest && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Why do you want to be an Empire Partner? *
                    </label>
                    <textarea
                      name="empirePartnerReason"
                      value={formData.empirePartnerReason}
                      onChange={handleInputChange}
                      placeholder="Explain your motivation for becoming an Empire Partner and how you plan to manage creators..."
                      rows={3}
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        errors.empirePartnerReason ? 'border-red-500' : 'border-slate-600'
                      }`}
                    />
                    {errors.empirePartnerReason && (
                      <p className="text-red-400 text-sm mt-1">{errors.empirePartnerReason}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}