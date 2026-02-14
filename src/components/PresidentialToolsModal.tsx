import React, { useState } from 'react';
import { usePresidentSystem } from '@/hooks/usePresidentSystem';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Crown, Megaphone, FileText, DollarSign, Flag, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function PresidentialToolsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    isPresident, 
    isVP, 
    treasuryBalance, 
    postAnnouncement, 
    createProposal, 
    spendTreasury, 
    flagUser 
  } = usePresidentSystem();

  const [announcement, setAnnouncement] = useState('');
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');
  const [proposalType, setProposalType] = useState('tax_change');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendReason, setSpendReason] = useState('');
  const [flagTargetId, setFlagTargetId] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isPresident && !isVP) return null;

  const handleAnnouncement = async () => {
    if (!announcement) return;
    setLoading(true);
    await postAnnouncement(announcement);
    setAnnouncement('');
    setLoading(false);
  };

  const handleProposal = async () => {
    if (!proposalTitle || !proposalDesc) return;
    setLoading(true);
    await createProposal(proposalTitle, proposalDesc, proposalType);
    setProposalTitle('');
    setProposalDesc('');
    setLoading(false);
  };

  const handleSpend = async () => {
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    if (amount > 250) {
      toast.error('Maximum spend per transaction is $250.');
      return;
    }

    if (!confirm(`Are you sure you want to spend $${amount} from the Treasury? This will be logged.`)) return;

    setLoading(true);
    await spendTreasury(amount, spendReason);
    setSpendAmount('');
    setSpendReason('');
    setLoading(false);
  };

  const handleFlag = async () => {
    if (!flagTargetId || !flagReason) return;
    setLoading(true);
    await flagUser(flagTargetId, flagReason);
    setFlagTargetId('');
    setFlagReason('');
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
            variant="outline" 
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 gap-2"
        >
          <Crown className="w-4 h-4" />
          <span className="hidden sm:inline">Presidential Tools</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0a18] border-amber-500/30 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <Crown className="w-6 h-6" />
            Presidential Office
            <span className="ml-auto text-sm text-green-400 font-mono">
              Treasury: ${treasuryBalance.toFixed(2)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="announcement" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="announcement"><Megaphone className="w-4 h-4 mr-2" />Announce</TabsTrigger>
            <TabsTrigger value="proposal"><FileText className="w-4 h-4 mr-2" />Proposal</TabsTrigger>
            <TabsTrigger value="treasury"><DollarSign className="w-4 h-4 mr-2" />Treasury</TabsTrigger>
            <TabsTrigger value="flag"><Flag className="w-4 h-4 mr-2" />Flag User</TabsTrigger>
          </TabsList>

          {/* Announcement Tab */}
          <TabsContent value="announcement" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Official Announcement</Label>
              <Textarea 
                placeholder="Make a statement to the city..." 
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
              <p className="text-xs text-slate-500">Rate limited: Once every 4 hours.</p>
            </div>
            <Button onClick={handleAnnouncement} disabled={loading || !announcement} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading ? 'Posting...' : 'Post Announcement'}
            </Button>
          </TabsContent>

          {/* Proposal Tab */}
          <TabsContent value="proposal" className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Proposal Title</Label>
                <Input 
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    placeholder="e.g., Increase Tax on Trolls"
                    className="bg-slate-950 border-slate-800"
                />
            </div>
            <div className="space-y-2">
                <Label>Type</Label>
                <select 
                    value={proposalType}
                    onChange={(e) => setProposalType(e.target.value)}
                    className="w-full p-2 rounded bg-slate-950 border border-slate-800 text-white"
                >
                    <option value="tax_change">Tax Change</option>
                    <option value="event">Event Proposal</option>
                    <option value="rule_change">Rule Change</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                    value={proposalDesc}
                    onChange={(e) => setProposalDesc(e.target.value)}
                    placeholder="Explain your proposal..."
                    className="bg-slate-950 border-slate-800"
                />
            </div>
            <Button onClick={handleProposal} disabled={loading || !proposalTitle} className="w-full bg-purple-600 hover:bg-purple-700">
              Submit to Secretary
            </Button>
          </TabsContent>

          {/* Treasury Tab */}
          <TabsContent value="treasury" className="space-y-4 py-4">
            <div className="p-4 border border-red-900/50 bg-red-900/10 rounded-lg mb-4">
                <h3 className="font-bold text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Warning
                </h3>
                <p className="text-sm text-red-300">
                    All spending is public and audited. Misuse will result in impeachment.
                    <br/>Max per transaction: $250. Max per day: $1000.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input 
                        type="number" 
                        value={spendAmount}
                        onChange={(e) => setSpendAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-slate-950 border-slate-800"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Reason</Label>
                    <Input 
                        value={spendReason}
                        onChange={(e) => setSpendReason(e.target.value)}
                        placeholder="e.g., Event Prize"
                        className="bg-slate-950 border-slate-800"
                    />
                </div>
            </div>
            <Button onClick={handleSpend} disabled={loading || !spendAmount} className="w-full bg-green-600 hover:bg-green-700">
              Authorize Spend
            </Button>
          </TabsContent>

          {/* Flag User Tab */}
          <TabsContent value="flag" className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>User ID (UUID)</Label>
                <Input 
                    value={flagTargetId}
                    onChange={(e) => setFlagTargetId(e.target.value)}
                    placeholder="Enter User ID..."
                    className="bg-slate-950 border-slate-800"
                />
                <p className="text-xs text-slate-500">Currently requires manual UUID entry. Search coming soon.</p>
            </div>
            <div className="space-y-2">
                <Label>Reason for Flag</Label>
                <Input 
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="e.g., Disruptive behavior"
                    className="bg-slate-950 border-slate-800"
                />
            </div>
            <Button onClick={handleFlag} disabled={loading || !flagTargetId} className="w-full bg-red-600 hover:bg-red-700">
              Flag for Review
            </Button>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
