/**
 * TickerSubmissionModal Component
 * 
 * Modal for News Casters to submit ticker messages
 */
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useTCNNRoles } from '@/hooks/useTCNNRoles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Send,
  Clock,
  Newspaper,
  X
} from 'lucide-react';

interface TickerSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CooldownInfo {
  canSubmit: boolean;
  remainingSeconds: number;
  nextAvailableAt: Date | null;
}

const COOLDOWN_SECONDS = 300; // 5 minutes between submissions

export default function TickerSubmissionModal({
  isOpen,
  onClose,
  onSuccess
}: TickerSubmissionModalProps) {
  const { user } = useAuthStore();
  const { isNewsCaster, isChiefNewsCaster } = useTCNNRoles(user?.id);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'breaking'>('normal');
  const [duration, setDuration] = useState(60); // seconds
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<CooldownInfo>({
    canSubmit: true,
    remainingSeconds: 0,
    nextAvailableAt: null
  });

  // Check cooldown on mount
  useState(() => {
    checkCooldown();
  });

  const checkCooldown = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tcnn_ticker_queue')
        .select('created_at')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setCooldown({ canSubmit: true, remainingSeconds: 0, nextAvailableAt: null });
        return;
      }

      const lastSubmission = new Date(data.created_at);
      const now = new Date();
      const secondsSinceLastSubmission = Math.floor((now.getTime() - lastSubmission.getTime()) / 1000);
      
      if (secondsSinceLastSubmission < COOLDOWN_SECONDS) {
        const remaining = COOLDOWN_SECONDS - secondsSinceLastSubmission;
        const nextAvailable = new Date(now.getTime() + remaining * 1000);
        setCooldown({
          canSubmit: false,
          remainingSeconds: remaining,
          nextAvailableAt: nextAvailable
        });
      } else {
        setCooldown({ canSubmit: true, remainingSeconds: 0, nextAvailableAt: null });
      }
    } catch (err) {
      console.error('Error checking cooldown:', err);
      setCooldown({ canSubmit: true, remainingSeconds: 0, nextAvailableAt: null });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Permission check
    if (!isNewsCaster && !isChiefNewsCaster) {
      setError('Only News Casters can submit ticker messages');
      return;
    }

    // Cooldown check
    if (!cooldown.canSubmit) {
      setError(`Please wait ${cooldown.remainingSeconds} seconds before submitting again`);
      return;
    }

    // Validation
    if (!message.trim()) {
      setError('Message is required');
      return;
    }

    if (message.length > 200) {
      setError('Message must be 200 characters or less');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await supabase
        .from('tcnn_ticker_queue')
        .insert({
          message: message.trim(),
          ticker_type: priority === 'breaking' ? 'breaking' : 'standard',
          priority: priority === 'breaking' ? 3 : 1,
          submitted_by: user.id,
          status: 'approved',
          created_at: new Date().toISOString()
        });

      if (submitError) throw submitError;

      // Reset form
      setMessage('');
      setPriority('normal');
      setDuration(60);
      
      // Set cooldown
      setCooldown({
        canSubmit: false,
        remainingSeconds: COOLDOWN_SECONDS,
        nextAvailableAt: new Date(Date.now() + COOLDOWN_SECONDS * 1000)
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error submitting ticker:', err);
      setError(err.message || 'Failed to submit ticker message');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCooldown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Only News Casters and Chief News Casters can access this
  if (!isNewsCaster && !isChiefNewsCaster) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Newspaper className="w-5 h-5 text-blue-400" />
            Submit Ticker Message
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Submit a message for the global ticker. Breaking news requires approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-gray-300">
              Message <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your ticker message..."
              maxLength={200}
              rows={3}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{message.length}/200 characters</span>
              <span>{priority === 'breaking' ? 'Will show as BREAKING NEWS' : 'Standard ticker message'}</span>
            </div>
          </div>

          {/* Priority Select */}
          <div className="space-y-2">
            <Label htmlFor="priority" className="text-gray-300">
              Priority
            </Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="normal" className="text-white">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Normal
                  </span>
                </SelectItem>
                <SelectItem value="high" className="text-white">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                    High Priority
                  </span>
                </SelectItem>
                <SelectItem value="breaking" className="text-white">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Breaking News (Requires Approval)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration Select */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Display Duration
            </Label>
            <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="30" className="text-white">30 seconds</SelectItem>
                <SelectItem value="60" className="text-white">1 minute</SelectItem>
                <SelectItem value="120" className="text-white">2 minutes</SelectItem>
                <SelectItem value="300" className="text-white">5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Cooldown Warning */}
          {!cooldown.canSubmit && (
            <Card className="p-3 bg-yellow-500/10 border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <p className="text-sm text-yellow-400">
                  Cooldown active: {formatCooldown(cooldown.remainingSeconds)} remaining
                </p>
              </div>
            </Card>
          )}

          {/* Breaking News Warning */}
          {priority === 'breaking' && (
            <Card className="p-3 bg-red-500/10 border-red-500/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div className="text-sm text-red-400">
                  <p className="font-semibold">Breaking News Notice</p>
                  <p className="mt-1">
                    Breaking news messages require approval from the Chief News Caster before being displayed. 
                    Misuse of this feature may result in removal of your News Caster role.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-transparent border-slate-600 text-gray-300 hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !cooldown.canSubmit || !message.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Submit
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
