import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function BraintreeCheckoutModal({ isOpen, onClose, pkg, onSuccess }) {
  const dropinRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [instance, setInstance] = useState(null);

  useEffect(() => {
    let mounted = true;
    let cleanup = null;

    const init = async () => {
      if (!isOpen) return;
      if (!pkg) return;
      setInitializing(true);
      try {
        const res = await supabase.functions.invoke('braintree-token');
        const clientToken = res?.data?.clientToken || res?.clientToken || res?.data?.client_token || res?.client_token;
        if (!clientToken) throw new Error('Failed to obtain client token');

        const dropinModule = await import('braintree-web-drop-in');
        const dropin = dropinModule.default || dropinModule;
        const created = await dropin.create({
          authorization: clientToken,
          container: containerRef.current,
        });

        if (!mounted) {
          try { if (created) await created.teardown(); } catch { }
          return;
        }

        setInstance(created);
        dropinRef.current = created;
        cleanup = async () => {
          try { if (created) await created.teardown(); } catch { }
        };
      } catch (err) {
        console.error('Braintree init error', err);
        toast.error('Could not start checkout. Please try again later.');
        if (onClose) onClose();
      } finally {
        setInitializing(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [isOpen, pkg, onClose]);

  const handleConfirm = async () => {
    if (!instance) {
      toast.error('Payment UI not ready');
      return;
    }

    setLoading(true);
    try {
      const payload = await instance.requestPaymentMethod();
      const nonce = payload?.nonce;
      if (!nonce) throw new Error('Failed to get payment method');

      const productType = (pkg && pkg.purchaseType && pkg.purchaseType.includes('troll_pass')) ? 'troll_pass' : 'coin_pack';
      const productId = pkg?.id || pkg?.package_id || pkg?.purchaseType || '';

      const { data, error } = await supabase.functions.invoke('braintree-checkout', {
        body: { productType, productId, nonce }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Payment failed');

      toast.success('Purchase complete');
      if (onSuccess) onSuccess(data);
    } catch (err) {
      console.error('Braintree checkout error', err);
      toast.error(err?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!isOpen} onOpenChange={(open) => { if (!open) { if (onClose) onClose(); } }}>
      <DialogContent className={`sm:max-w-md bg-zinc-900 border-zinc-800 text-white`}>
        <DialogHeader>
          <DialogTitle className="text-xl">Checkout</DialogTitle>
          <DialogDescription className="text-zinc-400">Complete your purchase for {pkg?.coins ? `${pkg.coins.toLocaleString()} coins` : pkg?.name || 'selected item'}.</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 bg-zinc-800 p-4 rounded border border-zinc-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Package</span>
              <span className="font-bold text-yellow-400">{pkg?.coins ? pkg.coins.toLocaleString() + ' Coins' : pkg?.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total</span>
              <span className="font-bold text-white text-xl">{typeof pkg?.price === 'string' ? pkg.price : `$${(Number(pkg?.price || 0)).toFixed(2)}`}</span>
            </div>
          </div>

          <div id="braintree-dropin-container" ref={containerRef} className="mb-4" />
          {initializing && <div className="text-sm text-zinc-400">Starting checkout…</div>}
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleConfirm} disabled={loading || initializing} className="flex-1">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>) : 'Confirm Purchase'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
