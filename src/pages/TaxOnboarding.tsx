import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, FileText, CheckCircle } from 'lucide-react';

export default function TaxOnboarding() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: profile?.email || '',
    ssn: '',
    ein: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    taxClassification: 'individual', // individual or business
    agreed: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreed) {
      toast.error('You must agree to the terms');
      return;
    }

    if (!formData.fullName || !formData.email || (!formData.ssn && !formData.ein)) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Save tax information
      const { error } = await supabase
        .from('user_tax_info')
        .upsert({
          user_id: profile?.id,
          full_name: formData.fullName,
          email: formData.email,
          ssn: formData.ssn || null,
          ein: formData.ein || null,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          tax_classification: formData.taxClassification,
          w9_completed: true,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Tax information saved successfully');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error saving tax info:', error);
      toast.error('Failed to save tax information');
    } finally {
      setSubmitting(false);
    }
  };

  if (!profile) {
    return <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C] hover:bg-[#2A2A2A] transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <FileText className="w-8 h-8 text-troll-neon-blue" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
            Tax Information (W-9)
          </h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1A1A] rounded-xl border border-[#2C2C2C] p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-2">Why We Need This</h2>
            <p className="text-gray-300 text-sm">
              Since you've earned $600+ this year, we must collect your tax information for IRS reporting (Form 1099).
              This information is securely stored and only used for tax compliance.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tax Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tax Classification *
              </label>
              <select
                value={formData.taxClassification}
                onChange={(e) => setFormData(prev => ({ ...prev, taxClassification: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                required
              >
                <option value="individual">Individual/sole proprietor</option>
                <option value="business">Business entity (LLC, Corp, etc.)</option>
              </select>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Full Legal Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                placeholder="As it appears on your tax documents"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                required
              />
            </div>

            {/* SSN or EIN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Social Security Number (SSN)
                </label>
                <input
                  type="text"
                  value={formData.ssn}
                  onChange={(e) => setFormData(prev => ({ ...prev, ssn: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                  placeholder="XXX-XX-XXXX"
                  pattern="\d{3}-\d{2}-\d{4}"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Employer ID Number (EIN)
                </label>
                <input
                  type="text"
                  value={formData.ein}
                  onChange={(e) => setFormData(prev => ({ ...prev, ein: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                  placeholder="XX-XXXXXXX"
                  pattern="\d{2}-\d{7}"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">* One of SSN or EIN is required</p>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                required
              />
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ZIP Code *
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0D0D1A] border border-[#2C2C2C] rounded-lg text-white focus:border-troll-purple"
                  required
                />
              </div>
            </div>

            {/* Agreement */}
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.agreed}
                  onChange={(e) => setFormData(prev => ({ ...prev, agreed: e.target.checked }))}
                  className="mt-1 w-5 h-5 accent-troll-purple"
                />
                <span className="text-gray-300 text-sm">
                  I certify that the information provided is true and correct.
                  I understand that false information may result in penalties under federal law.
                  I authorize Troll City to report my earnings to the IRS.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !formData.agreed}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold rounded-lg
                       disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition transform"
            >
              {submitting ? 'Saving...' : 'Save Tax Information'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}