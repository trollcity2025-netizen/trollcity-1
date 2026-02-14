import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { ScrollArea } from '../../../../components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_by: string;
  created_at: string;
  creator?: {
    username: string;
    avatar_url: string;
  };
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

interface ProposalManagementPanelProps {
  viewMode: 'admin' | 'secretary';
}

export default function ProposalManagementPanel({ viewMode: _viewMode }: ProposalManagementPanelProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('president_proposals')
        .select(`
          *,
          creator:user_profiles!created_by(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const note = prompt(`Enter a review note for ${status.toUpperCase()}:`);
    if (note === null) return; // Cancelled

    try {
      const { error } = await supabase
        .from('president_proposals')
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: note
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Proposal ${status}`);
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update proposal');
    }
  };

  const filteredProposals = proposals.filter(p => 
    activeTab === 'all' ? true : p.status === activeTab
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
    approved: 'bg-green-500/20 text-green-500 border-green-500/50',
    rejected: 'bg-red-500/20 text-red-500 border-red-500/50',
    expired: 'bg-slate-500/20 text-slate-500 border-slate-500/50',
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Presidential Proposals
                </CardTitle>
                <CardDescription>Review and manage proposals from the President</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchProposals}>
                Refresh
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-950 border border-slate-800 mb-4">
                <TabsTrigger value="pending">Pending ({proposals.filter(p => p.status === 'pending').length})</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All History</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[500px] pr-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading proposals...</div>
                ) : filteredProposals.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No proposals found in this category
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredProposals.map((proposal) => (
                            <div key={proposal.id} className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="uppercase text-xs tracking-wider">
                                            {proposal.type}
                                        </Badge>
                                        <h3 className="font-bold text-white text-lg">{proposal.title}</h3>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold border uppercase ${statusColors[proposal.status]}`}>
                                        {proposal.status}
                                    </div>
                                </div>
                                
                                <p className="text-slate-400 mb-4 text-sm leading-relaxed">
                                    {proposal.description}
                                </p>

                                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-800 pt-3">
                                    <div className="flex items-center gap-2">
                                        <span>Submitted by {proposal.creator?.username || 'Unknown'}</span>
                                        <span>•</span>
                                        <span>{format(new Date(proposal.created_at), 'MMM d, yyyy HH:mm')}</span>
                                    </div>
                                    
                                    {proposal.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="destructive" 
                                                className="h-8"
                                                onClick={() => handleReview(proposal.id, 'rejected')}
                                            >
                                                <X className="w-3 h-3 mr-1" />
                                                Reject
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="h-8 bg-green-600 hover:bg-green-700"
                                                onClick={() => handleReview(proposal.id, 'approved')}
                                            >
                                                <Check className="w-3 h-3 mr-1" />
                                                Approve
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {(proposal.review_note || proposal.reviewed_at) && (
                                    <div className="mt-3 p-2 bg-slate-900/50 rounded text-xs text-slate-400 border border-slate-800">
                                        <span className="font-bold text-slate-300">Review Note:</span> {proposal.review_note || 'No notes'}
                                        <div className="mt-1 text-slate-600">
                                            Reviewed {proposal.reviewed_at ? format(new Date(proposal.reviewed_at), 'MMM d, HH:mm') : ''}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
