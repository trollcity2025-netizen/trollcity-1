import React, { useEffect, useRef, useState } from 'react';
import { supabase as client } from '../lib/supabase';

type Props = {
  packId: string;
  onSuccess?: (newBalance: number | null) => void;
};

export default function BraintreeDropIn({ packId, onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await client.functions.invoke('braintree-token');
        if (error) throw error;
        const token = (data as any)?.clientToken;
        if (!token) throw new Error('No client token');

        const dropin = await import('braintree-web-drop-in');
        if (!mounted) return;

        instanceRef.current = await dropin.create({
          authorization: token,
          container: containerRef.current as any,
          paypal: { flow: 'vault' },
          card: { cardholderName: true },
        });
      } catch (err) {
        console.error('Braintree init error', err);
      }
    })();
    return () => { mounted = false; if (instanceRef.current) instanceRef.current.teardown?.(); };
  }, []);

  const handleBuy = async () => {
    if (!instanceRef.current) return;
    setLoading(true);
    try {
      const payload = await instanceRef.current.requestPaymentMethod();
      const nonce = payload?.nonce;
      if (!nonce) throw new Error('No payment nonce returned');

      const { data, error } = await client.functions.invoke('braintree-checkout', {
        body: JSON.stringify({ packId, nonce }),
      });
      if (error) throw error;

      const success = (data as any)?.success;
      if (!success) throw new Error((data as any)?.error || 'Checkout failed');

      onSuccess?.((data as any)?.newBalance ?? null);
    } catch (err) {
      console.error('Checkout error', err);
      alert(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div ref={containerRef} />
      <button onClick={handleBuy} disabled={loading} style={{ marginTop: 8 }}>
        {loading ? 'Processing...' : 'Buy'}
      </button>
    </div>
  );
}
