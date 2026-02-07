import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { CheckCircle, Copy, Loader2, AlertCircle } from 'lucide-react';

const PROVIDERS = {
  venmo: {
    name: 'Venmo',
    handle: 'trollcityllc',
    prefix: '@',
    color: 'bg-[#008CFF]',
    icon: '📱'
  },
  paypal: {
    name: 'PayPal',
    handle: 'trollcity2025',
    prefix: '@',
    color: 'bg-[#00457C]',
    icon: '🅿️'
  },
  cashapp: {
    name: 'Cash App',
    handle: 'trollcity95',
    prefix: '$',
    color: 'bg-[#00D632]',
    icon: '💲'
  }
};

export default function ManualPaymentModal({ isOpen, onClose, pkg, providerId = 'venmo' }) {
  const { user, profile } = useAuthStore();
  const [step, setStep] = useState('input'); // input -> processing -> success
  const [payerHandle, setPayerHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderData, setOrderData] = useState(null);

  const provider = PROVIDERS[providerId] || PROVIDERS.venmo;

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleSubmit = async () => {
    if (!payerHandle.trim()) {
      toast.error(`Please enter your ${provider.name} handle`);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('manual-coin-order', {
        body: {
          action: 'create',
          package: pkg,
          coins: pkg.coins,
          amount_usd: typeof pkg.price === 'string' ? parseFloat(pkg.price.replace('$', '')) : pkg.price,
          payer_cashtag: payerHandle, // Using generic field for handle
          purchase_type: 'manual_' + providerId,
          username: profile?.username || user?.email?.split('@')[0]
        }
      });

      if (error) throw error;
      
      setOrderData(data);
      setStep('instructions');
    } catch (err) {
      console.error('Error creating order:', err);
      toast.error(err.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSent = () => {
    toast.success('Payment marked as sent! Admin will verify shortly.');
    onClose();
    setStep('input');
    setPayerHandle('');
    setOrderData(null);
  };

  if (!pkg) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {provider.icon} Pay with {provider.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {step === 'input' 
              ? `Enter your details to generate a payment request for ${pkg.coins.toLocaleString()} coins.` 
              : `Please complete your payment to receive ${pkg.coins.toLocaleString()} coins.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 py-4">
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400">Package</span>
                <span className="font-bold text-yellow-400">{pkg.coins.toLocaleString()} Coins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Price</span>
                <span className="font-bold text-white">{typeof pkg.price === 'number' ? `$${pkg.price.toFixed(2)}` : pkg.price}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">Your {provider.name} Handle</Label>
              <Input
                id="handle"
                placeholder={`${provider.prefix}yourusername`}
                value={payerHandle}
                onChange={(e) => setPayerHandle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <p className="text-xs text-zinc-500">
                Used to verify your payment.
              </p>
            </div>
          </div>
        )}

        {step === 'instructions' && orderData && (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-zinc-500 font-bold">1. Send Payment To</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 p-3 rounded font-mono text-lg border border-zinc-700 flex justify-between items-center">
                    <span>{provider.prefix}{provider.handle}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => handleCopy(provider.prefix + provider.handle, 'Handle')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-zinc-500 font-bold">2. Amount</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 p-3 rounded font-mono text-lg border border-zinc-700 flex justify-between items-center">
                    <span>{typeof pkg.price === 'number' ? `$${pkg.price.toFixed(2)}` : pkg.price}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-700" onClick={() => handleCopy(typeof pkg.price === 'number' ? pkg.price.toFixed(2) : pkg.price.replace('$', ''), 'Amount')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-zinc-500 font-bold">3. Include Note (Crucial!)</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-yellow-900/20 p-3 rounded font-mono text-lg border border-yellow-700/50 text-yellow-400 flex justify-between items-center">
                    <span>{orderData.note_suggested}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-yellow-900/40 text-yellow-400" onClick={() => handleCopy(orderData.note_suggested, 'Note')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    You MUST include this note for automated processing.
                  </p>
                  <p className="text-xs text-blue-400 font-bold flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Send as &quot;Friend/Family&quot; transaction to avoid fees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'input' ? (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !payerHandle}
              className={`w-full ${provider.color} hover:opacity-90 text-white`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Order...
                </>
              ) : (
                'Create Order Request'
              )}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <Button 
                onClick={handleConfirmSent} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                I Have Sent The Payment
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="w-full border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                Cancel / Do Later
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
