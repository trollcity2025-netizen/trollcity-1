import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { CreditCard, Loader2, CheckCircle, Shield, Lock } from 'lucide-react';

export default function SquarePaymentModal({ 
  isOpen, 
  onClose, 
  pkg, 
  userId,
  profile,
  onPaymentSuccess,
  onSaveCard = false,
  requireCardOnFile = false,
  onCardSaved,
  saveOnly = false,
}) {
  const [step, setStep] = useState('select'); // select -> processing -> success
  const [useSavedCard, setUseSavedCard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardHolderName, setCardHolderName] = useState(profile?.username || '');
  const [zip, setZip] = useState(profile?.zipcode || '');
  const [saveCard, setSaveCard] = useState(onSaveCard);
  const [paymentResult, setPaymentResult] = useState(null);
  const [squareLoading, setSquareLoading] = useState(false);
  const cardNumberRef = useRef<any>(null);
  const cardExpiryRef = useRef<any>(null);
  const cardCvvRef = useRef<any>(null);
  const cardPostalRef = useRef<any>(null);
  const cardRef = useRef<any>(null);
  const cardContainerId = useRef(`square-card-${Date.now()}`).current;
  const cardNumberId = useRef(`card-number-${Date.now()}`).current;
  const cardExpiryId = useRef(`card-expiry-${Date.now()}`).current;
  const cardCvvId = useRef(`card-cvv-${Date.now()}`).current;
  const cardPostalId = useRef(`card-postal-${Date.now()}`).current;

  const initSquareCard = useCallback(async () => {
    const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
    const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID
    const env = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox'

    console.log('Square config:', { appId, locationId, env });

    if (!appId || !locationId) {
      console.warn('Square not configured')
      return null
    }

    try {
      const sdkUrl = env === 'production'
        ? 'https://web.squarecdn.com/v1/square.js'
        : 'https://sandbox.web.squarecdn.com/v1/square.js'

      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = sdkUrl
          script.onload = () => {
            console.log('Square SDK loaded successfully');
            resolve()
          }
          script.onerror = () => reject(new Error('Failed to load Square SDK'))
          document.body.appendChild(script)
        })
      } else {
        console.log('Square SDK already loaded');
      }

      const payments = window.Square?.payments?.(appId, locationId)
      console.log('Square payments object:', payments);
      if (!payments) throw new Error('Square failed to initialize')

      if (saveOnly) {
        console.log('Initializing separate Square inputs for save-only mode');
        // TEMPORARILY DISABLED - Using regular inputs for testing
        /*
        // Check if DOM elements exist
        const cardNumberEl = document.getElementById(cardNumberId);
        const cardExpiryEl = document.getElementById(cardExpiryId);
        const cardCvvEl = document.getElementById(cardCvvId);
        const cardPostalEl = document.getElementById(cardPostalId);

        console.log('DOM elements found:', {
          cardNumber: !!cardNumberEl,
          cardExpiry: !!cardExpiryEl,
          cardCvv: !!cardCvvEl,
          cardPostal: !!cardPostalEl
        });

        if (!cardNumberEl || !cardExpiryEl || !cardCvvEl || !cardPostalEl) {
          console.warn('DOM elements not ready, retrying...');
          setTimeout(() => initSquareCard(), 200);
          return null;
        }

        // Use separate fields for save-only mode
        const cardNumberInput = await payments.cardNumber()
        const cardExpiryInput = await payments.cardExpiration()
        const cardCvvInput = await payments.cardCvv()
        const cardPostalInput = await payments.cardPostalCode()

        console.log('Attaching to IDs:', cardNumberId, cardExpiryId, cardCvvId, cardPostalId);
        try {
          await cardNumberInput.attach(`#${cardNumberId}`)
          console.log('Card number input attached successfully');
        } catch (error) {
          console.error('Failed to attach card number input:', error);
        }
        
        try {
          await cardExpiryInput.attach(`#${cardExpiryId}`)
          console.log('Card expiry input attached successfully');
        } catch (error) {
          console.error('Failed to attach card expiry input:', error);
        }
        
        try {
          await cardCvvInput.attach(`#${cardCvvId}`)
          console.log('Card CVV input attached successfully');
        } catch (error) {
          console.error('Failed to attach card CVV input:', error);
        }
        
        try {
          await cardPostalInput.attach(`#${cardPostalId}`)
          console.log('Card postal input attached successfully');
        } catch (error) {
          console.error('Failed to attach card postal input:', error);
        }

        cardNumberRef.current = cardNumberInput
        cardExpiryRef.current = cardExpiryInput
        cardCvvRef.current = cardCvvInput
        cardPostalRef.current = cardPostalInput

        console.log('Square inputs initialized successfully');
        return { cardNumberInput, cardExpiryInput, cardCvvInput, cardPostalInput }
        */
        return null
      } else {
        // Use single card input for payment mode
        const card = await payments.card()
        await card.attach(`#${cardContainerId}`)
        cardRef.current = card
        return card
      }
    } catch (err) {
      console.error('Square card init error:', err)
      return null
    }
  }, [cardContainerId, saveOnly, cardNumberId, cardExpiryId, cardCvvId, cardPostalId])

  useLayoutEffect(() => {
    console.log('useLayoutEffect triggered:', { isOpen, step, useSavedCard, saveOnly });
    console.log('Modal state:', { isOpen, step, useSavedCard, saveOnly, hasSavedCard });
    if (isOpen && step === 'select' && (!useSavedCard || saveOnly)) {
      console.log('Initializing Square card inputs...');
      setTimeout(() => initSquareCard(), 100)
    }
    return () => {
      if (cardNumberRef.current) {
        try { cardNumberRef.current.destroy() } catch {}
        cardNumberRef.current = null
      }
      if (cardExpiryRef.current) {
        try { cardExpiryRef.current.destroy() } catch {}
        cardExpiryRef.current = null
      }
      if (cardCvvRef.current) {
        try { cardCvvRef.current.destroy() } catch {}
        cardCvvRef.current = null
      }
      if (cardPostalRef.current) {
        try { cardPostalRef.current.destroy() } catch {}
        cardPostalRef.current = null
      }
      if (cardRef.current) {
        try { cardRef.current.destroy() } catch {}
        cardRef.current = null
      }
    }
  }, [isOpen, step, useSavedCard, initSquareCard])

  const coins = (pkg as any)?.coins ?? (pkg as any)?.coin_amount ?? (pkg as any)?.coinAmount;
  const rawPrice = (pkg as any)?.price_usd ?? (pkg as any)?.amount_usd ?? (pkg as any)?.price;
  const amountUsd = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice ?? '').replace(/[^0-9.]/g, '').trim());
  const packageName = (pkg as any)?.name || `${coins} Troll Coins`;
  const packageId = (pkg as any)?.id || 'coins';
  const purchaseType = (pkg as any)?.purchaseType || 'coins';

  const hasSavedCard = Boolean(profile?.square_card_id && profile?.square_customer_id)

  const initialSaveCard = requireCardOnFile || !hasSavedCard || onSaveCard

  useEffect(() => {
    setSaveCard(initialSaveCard)
    // For saveOnly mode, never default to using saved card
    setUseSavedCard(saveOnly ? false : hasSavedCard)
  }, [hasSavedCard, initialSaveCard, saveOnly])



  const handlePayment = async () => {
    if (!userId) {
      toast.error('Please sign in to continue');
      return;
    }

    if (saveOnly) {
      await processSaveCardOnly();
      return;
    }

    if (!hasSavedCard) {
      // User must save a card before charging, so always tokenizing and saving in this path
      setSaveCard(true)
      await processNewCardPayment();
      return;
    }

    if (useSavedCard && hasSavedCard) {
      await processStoredCardPayment();
    } else {
      // If user has a card but wants to replace/add now, save a new card
      await processNewCardPayment();
    }
  };

  const processStoredCardPayment = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('charge-stored-card', {
        body: {
          userId,
          amountUsd,
          coins,
          packageId,
          packageName,
          purchaseType,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Payment failed');

      setPaymentResult(data);
      setStep('success');
      onPaymentSuccess?.(data);
    } catch (err) {
      console.error('Stored card payment error:', err);
      toast.error(err?.message || 'Payment failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processSaveCardOnly = async () => {
    // TEMPORARILY DISABLED - Using regular inputs for testing
    console.log('Save card process started with regular inputs');
    setStep('success');
    onCardSaved?.();
  };

  const processNewCardPayment = async () => {
    if (!cardRef.current && !hasSavedCard) {
      toast.error('Square card input is not initialized yet. Please wait a moment and try again.');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      let customerId = ''
      let cardNonce = ''

      // Tokenize card for saving (if requested)
      if (saveCard && cardRef.current) {
        const tokenResult = await cardRef.current.tokenize({
          intent: 'STORE',
          cardholderName: cardHolderName || undefined,
          billingPostalCode: zip || undefined,
        });
        if (tokenResult.status === 'OK' && tokenResult.token) {
          cardNonce = tokenResult.token;
        } else {
          const errMsg = tokenResult.errors?.[0]?.message || 'Card tokenization failed';
          throw new Error(errMsg);
        }
      }

      // Create checkout with Square (user completes payment via link)
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-square-checkout', {
        body: {
          userId,
          coins,
          amountUsd,
          packageId,
          packageName,
          purchaseType,
        },
      });

      if (checkoutError) throw checkoutError;
      if (!checkoutData?.success) throw new Error(checkoutData?.error || 'Failed to create payment');

      customerId = checkoutData?.customerId || ''

      if (saveCard && cardNonce && customerId) {
        const { data: saveData, error: saveError } = await supabase.functions.invoke('add-card', {
          body: {
            userId,
            cardNonce,
            provider: 'square',
            customerId,
          },
        });
        if (saveError) throw saveError;
        if (!saveData?.success) throw new Error(saveData?.error || 'Failed to save card');
        console.log('Card saved for future use:', saveData?.cardId);
      }

      // Open Square payment page in new window
      if (checkoutData?.paymentUrl) {
        const paymentWindow = window.open(checkoutData.paymentUrl, '_blank', 'width=600,height=700');
        
        // Poll for payment completion
        const checkPayment = async () => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-square-payment', {
              body: {
                orderId: checkoutData.orderId,
                userId,
                expectedAmount: amountUsd,
              },
            });

            if (!verifyError && verifyData?.verified) {
              setPaymentResult(verifyData);
              setStep('success');
              onPaymentSuccess?.(verifyData);
              return true;
            }
          } catch (e) {
            console.error('Payment verification error:', e);
          }
          return false;
        };

        // Start polling
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          const success = await checkPayment();
          if (success || attempts >= 30) {
            clearInterval(pollInterval);
            if (attempts >= 30 && step !== 'success') {
              toast.error('Payment verification timed out. Please check your payment status.');
              setStep('select');
            }
          }
        }, 2000);

        return;
      }

      // Fallback: Show order details for manual payment
      setPaymentResult({ 
        orderId: checkoutData?.orderId, 
        amount: amountUsd,
        message: 'Payment link created. Please complete payment manually.' 
      });
      setStep('success');
      onPaymentSuccess?.(paymentResult);

    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err?.message || 'Payment failed. Please try again.');
      setStep('select');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setUseSavedCard(hasSavedCard || false);
    setPaymentResult(null);
    onClose();
  };

  if (!pkg) return null;

  console.log('SquarePaymentModal rendering:', { isOpen, saveOnly, step, useSavedCard });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-5 h-5 text-purple-400" />
            {saveOnly ? 'Save Card' : 'Pay with Card'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {saveOnly 
              ? 'Save your card for future purchases'
              : step === 'select' 
                ? `Complete your purchase of ${coins?.toLocaleString()} coins for $${amountUsd?.toFixed(2)}`
                : step === 'processing'
                ? 'Processing...'
                : 'Card saved successfully!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-4">
            {!saveOnly && (
              <>
                {/* Package Summary */}
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-400">Package</span>
                    <span className="font-bold text-yellow-400">{coins?.toLocaleString()} Coins</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total</span>
                    <span className="font-bold text-white text-xl">${amountUsd?.toFixed(2)}</span>
                  </div>
                </div>

                {/* Saved Card Option */}
                {!saveOnly && hasSavedCard && (
                  <div 
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      useSavedCard 
                        ? 'bg-purple-900/30 border-purple-500/50' 
                        : 'bg-black/20 border-white/10 hover:border-purple-500/30'
                    }`}
                    onClick={() => setUseSavedCard(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-purple-400" />
                        <div>
                          <div className="font-semibold text-sm">Use Saved Card</div>
                          <div className="text-xs text-zinc-400">•••• {profile?.square_card_id?.slice(-4) || '****'}</div>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${useSavedCard ? 'bg-purple-500 border-purple-500' : 'border-zinc-500'}`} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* New Card Form */}
            {!useSavedCard && (
              <>
                {console.log('Rendering card form, saveOnly:', saveOnly, 'useSavedCard:', useSavedCard)}
                {saveOnly ? (
                  // Separate fields for save-only mode
                  <>
                    {console.log('Rendering saveOnly form')}
                    <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Cardholder Name</Label>
                      <Input
                        placeholder="Full Name"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Card Number</Label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          className="w-full px-3 py-2 border border-zinc-700 rounded-md bg-white text-black"
                          maxLength={19}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Expiration (MM/YY)</Label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          className="w-full px-3 py-2 border border-zinc-700 rounded-md bg-white text-black"
                          maxLength={5}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>CVV (3 digits)</Label>
                        <input
                          type="text"
                          placeholder="123"
                          className="w-full px-3 py-2 border border-zinc-700 rounded-md bg-white text-black"
                          maxLength={4}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Zip Code</Label>
                        <input
                          type="text"
                          placeholder="12345"
                          className="w-full px-3 py-2 border border-zinc-700 rounded-md bg-white text-black"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        disabled={requireCardOnFile || !hasSavedCard || saveOnly}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500"
                      />
                      <span className="text-sm text-zinc-400">
                        {saveOnly || requireCardOnFile || !hasSavedCard
                          ? 'Card will be saved for future purchases'
                          : 'Save card for future purchases'}
                      </span>
                    </label>
                  </div>
                  </>
                ) : (
                  // Single card input for payment mode
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Cardholder Name (optional)</Label>
                      <Input
                        id="cardholderName"
                        placeholder="Full Name"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Card details (Square secure input)</Label>
                      <div
                        id={cardContainerId}
                        className="min-h-[100px] bg-zinc-800 rounded-md border border-zinc-700 p-3"
                      />
                      <p className="text-xs text-zinc-500">Card number, expiry, CVV, and postal code are captured securely by Square.</p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        disabled={requireCardOnFile || !hasSavedCard || saveOnly}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500"
                      />
                      <span className="text-sm text-zinc-400">
                        {saveOnly || requireCardOnFile || !hasSavedCard
                          ? 'Card will be saved for future purchases'
                          : 'Save card for future purchases'}
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Lock className="w-3 h-3" />
              <span>Secured by Square. Your payment info is encrypted.</span>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
            <p className="text-zinc-400">Processing payment...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-6 flex flex-col items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
            <p className="text-lg font-semibold text-white mb-2">{saveOnly ? 'Card Saved!' : 'Payment Successful!'}</p>
            <p className="text-zinc-400 text-sm">
              {saveOnly ? 'Your card has been saved for future purchases.' : `${coins?.toLocaleString()} coins have been added to your wallet.`}
            </p>
            {paymentResult?.orderId && (
              <p className="text-xs text-zinc-500 mt-2">Order: {paymentResult.orderId}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'select' ? (
            <Button
              onClick={handlePayment}
              disabled={isSubmitting || (!hasSavedCard && !cardHolderName)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>Pay ${amountUsd?.toFixed(2)}</>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {step === 'success' ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}