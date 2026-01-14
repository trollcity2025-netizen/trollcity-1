import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, UserPlus, Search, Crown, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function AssignRecruitPanel() {
  interface PartnerProfile {
    id: string;
    username?: string;
    display_name?: string;
    role?: string;
  }
  interface EmpirePartner {
    user_id: string;
    empire_partner_request: boolean;
    status: string;
    profiles?: PartnerProfile | null;
  }
  interface Recruit {
    id: string;
    username?: string;
    display_name?: string;
    is_contracted?: boolean;
    recruiter_id?: string | null;
  }
  const [partners, setPartners] = useState<EmpirePartner[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [selectedRecruit, setSelectedRecruit] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      
      // Load Empire Partners (users with approved applications and empire_partner_request)
      const { data: partnersData, error: partnersError } = await supabase
        .from('creator_applications')
        .select(`
          user_id,
          empire_partner_request,
          status,
          profiles!inner(
            id,
            username,
            display_name,
            role
          )
        `)
        .eq('status', 'approved')
        .eq('empire_partner_request', true);

      if (partnersError) throw partnersError;
      const partnerRows = (partnersData || []) as any[];
      const mappedPartners: EmpirePartner[] = partnerRows.map((row) => ({
        user_id: row.user_id,
        empire_partner_request: row.empire_partner_request,
        status: row.status,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      }));
      setPartners(mappedPartners);

      // Load available recruits (users with approved TrollTract but not assigned to a partner)
      const { data: recruitsData, error: recruitsError } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          display_name,
          is_contracted,
          recruiter_id
        `)
        .eq('is_contracted', true)
        .is('recruiter_id', null)
        .neq('role', 'admin');

      if (recruitsError) throw recruitsError;
      setRecruits((recruitsData as Recruit[]) || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignRecruit = async () => {
    if (!selectedPartner || !selectedRecruit) {
      alert('Please select both a partner and a recruit.');
      return;
    }

    if (selectedPartner === selectedRecruit) {
      alert('A user cannot recruit themselves.');
      return;
    }

    try {
      setAssigning(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ recruiter_id: selectedPartner })
        .eq('id', selectedRecruit);

      if (error) throw error;

      // Refresh data
      await loadData();
      setSelectedPartner('');
      setSelectedRecruit('');
      
      alert('Recruit assigned successfully!');
    } catch (error) {
      console.error('Error assigning recruit:', error);
      alert('Failed to assign recruit. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredPartners = partners.filter(partner => 
    partner.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    partner.profiles?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRecruits = recruits.filter(recruit => 
    recruit.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recruit.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="bg-slate-950/60 border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading data...</span>
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
            <UserPlus className="w-5 h-5 text-purple-400" />
            Assign Recruit to Empire Partner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-300 text-sm">
            Manually assign recruits to Empire Partners instead of using automatic referral links.
          </p>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="bg-slate-950/60 border-slate-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Empire Partners */}
        <Card className="bg-slate-950/60 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <Crown className="w-5 h-5 text-yellow-400" />
              Empire Partners
              <Badge variant="outline" className="text-xs">
                {filteredPartners.length} available
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {filteredPartners.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No Empire Partners found.</p>
            ) : (
              filteredPartners.map((partner) => (
                <div
                  key={partner.user_id}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedPartner === partner.user_id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedPartner(partner.user_id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                      <Crown className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-200">
                        {partner.profiles?.display_name || partner.profiles?.username || 'Unknown'}
                      </p>
                      {partner.profiles?.username && (
                        <p className="text-sm text-slate-400">@{partner.profiles.username}</p>
                      )}
                    </div>
                    {selectedPartner === partner.user_id && (
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Available Recruits */}
        <Card className="bg-slate-950/60 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <Users className="w-5 h-5 text-blue-400" />
              Available Recruits
              <Badge variant="outline" className="text-xs">
                {filteredRecruits.length} unassigned
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {filteredRecruits.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No available recruits found.</p>
            ) : (
              filteredRecruits.map((recruit) => (
                <div
                  key={recruit.id}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedRecruit === recruit.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedRecruit(recruit.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-200">
                        {recruit.display_name || recruit.username || 'Unknown'}
                      </p>
                      {recruit.username && (
                        <p className="text-sm text-slate-400">@{recruit.username}</p>
                      )}
                    </div>
                    {selectedRecruit === recruit.id && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assignment Summary */}
      {selectedPartner && selectedRecruit && (
        <Card className="bg-slate-950/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-50">Assignment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Crown className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-200">
                    {partners.find(p => p.user_id === selectedPartner)?.profiles?.display_name ||
                     partners.find(p => p.user_id === selectedPartner)?.profiles?.username}
                  </p>
                  <p className="text-sm text-slate-400">Empire Partner</p>
                </div>
              </div>
              
              <div className="text-slate-400">→</div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-200">
                    {recruits.find(r => r.id === selectedRecruit)?.display_name ||
                     recruits.find(r => r.id === selectedRecruit)?.username}
                  </p>
                  <p className="text-sm text-slate-400">Recruit</p>
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleAssignRecruit}
              disabled={assigning}
              className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign Recruit
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-slate-950/60 border-slate-800">
        <CardContent className="p-4">
          <div className="text-sm text-slate-300 space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Empire Partners are users who requested Empire Partner status in their application</li>
              <li>Available recruits are contracted users not yet assigned to a partner</li>
              <li>Assignments are permanent and cannot be changed without admin intervention</li>
              <li>Partners will earn commissions from their assigned recruits' activity</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
