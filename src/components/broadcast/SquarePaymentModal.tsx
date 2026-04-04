import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { CreditCard, Loader2, CheckCircle, Lock } from 'lucide-react'
import { 
  encryptCardData, 
  decryptCardData, 
  maskCardNumber, 
  validateCardNumber, 
  validateExpiry, 
  validateCVV,
  CardData 
} from '@/lib/cardEncryption'

interface SquarePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
  userId: string;
  profile: any;
  onPaymentSuccess?: (data: any) => void;
  onSaveCard?: boolean;
  requireCardOnFile?: boolean;
  onCardSaved?: () => void;
  saveOnly?: boolean;
  onProfileUpdate?: (profile: any) => void;
}

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
  onProfileUpdate,
}: SquarePaymentModalProps) {
  const [step, setStep] = useState<'select' | 'processing' | 'success'>('select');
  const [useSavedCard, setUseSavedCard] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  
  // Card input fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiryMonth, setCardExpiryMonth] = useState('');
  const [cardExpiryYear, setCardExpiryYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPostalCode, setCardPostalCode] = useState(profile?.zipcode || '');
  const [cardHolderName, setCardHolderName] = useState(profile?.username || '');
  const [saveCard, setSaveCard] = useState(onSaveCard || requireCardOnFile);
  
  // Validation errors
  const [cardErrors, setCardErrors] = useState<{
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    postalCode?: string;
  }>({});

  const coins = pkg?.coins ?? pkg?.coin_amount ?? pkg?.coinAmount;
  const rawPrice = pkg?.price_usd ?? pkg?.amount_usd ?? pkg?.price;
  const amountUsd = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice ?? '').replace(/[^0-9.]/g, '').trim());
  const packageName = pkg?.name || `${coins} Troll Coins`;
  const packageId = pkg?.id || 'coins';
  const purchaseType = pkg?.purchaseType || 'coins';

  // Check for locally saved card OR from user_payment_methods table
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('user_payment_methods')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .limit(5);
        
        if (!error && data) {
          setSavedPaymentMethods(data);
        }
      } catch (err) {
        console.error('Failed to fetch payment methods:', err);
      }
    };
    
    if (userId) {
      fetchPaymentMethods();
    }
  }, [userId]);

  // Check for locally saved card
  const hasSavedCard = Boolean(profile?.encrypted_card_data) || savedPaymentMethods.length > 0;
  const [decryptedCard, setDecryptedCard] = useState<CardData | null>(null);

  // Load and decrypt saved card on mount
  useEffect(() => {
    if (profile?.encrypted_card_data) {
      decryptCardData(profile.encrypted_card_data).then(setDecryptedCard);
    }
  }, [profile?.encrypted_card_data]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setUseSavedCard(hasSavedCard && !saveOnly);
      const defaultMethod = savedPaymentMethods.find(pm => pm.is_default) || savedPaymentMethods[0];
      setSelectedPaymentMethodId(defaultMethod?.id || null);
      setCardNumber('');
      setCardExpiryMonth('');
      setCardExpiryYear('');
      setCardCvv('');
      setCardPostalCode(profile?.zipcode || '');
      setCardHolderName(profile?.username || '');
      setSaveCard(onSaveCard || requireCardOnFile || !hasSavedCard);
      setCardErrors({});
    }
  }, [isOpen, hasSavedCard, saveOnly, onSaveCard, requireCardOnFile, savedPaymentMethods]);

  const validateCard = useCallback((): boolean => {
    const errors: typeof cardErrors = {};
    
    // Validation for new card
    if (!useSavedCard) {
      const cleanNumber = cardNumber.replace(/\s/g, '');
      if (!cleanNumber) {
        errors.cardNumber = 'Card number is required';
      } else if (!validateCardNumber(cleanNumber)) {
        errors.cardNumber = 'Invalid card number';
      }
      
      if (!cardExpiryMonth || !cardExpiryYear) {
        errors.expiry = 'Expiry date is required';
      } else if (!validateExpiry(cardExpiryMonth, cardExpiryYear)) {
        errors.expiry = 'Invalid or expired date';
      }
      
      if (!cardCvv) {
        errors.cvv = 'CVV is required';
      } else if (!validateCVV(cardCvv)) {
        errors.cvv = 'Invalid CVV';
      }
      
      if (!cardPostalCode) {
        errors.postalCode = 'Postal code is required';
      }
    }
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  }, [cardNumber, cardExpiryMonth, cardExpiryYear, cardCvv, cardPostalCode, useSavedCard]);

  const handleSaveCard = async () => {
    if (!userId) {
      toast.error('Please sign in to continue');
      return;
    }

    if (!validateCard()) {
      toast.error('Please correct the errors before continuing');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      const cleanNumber = cardNumber.replace(/\s/g, '');
      
      const cardData: CardData = {
        cardNumber: cleanNumber,
        expiryMonth: cardExpiryMonth,
        expiryYear: cardExpiryYear,
        cvv: cardCvv,
        postalCode: cardPostalCode,
        cardholderName: cardHolderName,
      };

      const encrypted = await encryptCardData(cardData);

      // Update profile with encrypted card data
      const profileUpdate: any = { encrypted_card_data: encrypted };
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (updateError) throw updateError;

      // Save to user_payment_methods table using add-card Edge Function
      const { data: saveResult, error: saveError } = await supabase.functions.invoke('add-card', {
        body: {
          userId,
          cardNonce: cardNonce, // Should be set from Square Web Payments SDK
          provider: 'square'
        }
      });

      if (saveError || !saveResult?.success) {
        console.error('Failed to save card to Square:', saveError || saveResult?.error);
        // Continue without payment method for now, but card data is still encrypted locally
      }

      if (paymentMethodError) {
        console.error('Failed to save payment method:', paymentMethodError);
      } else {
        console.log('Payment method saved successfully');
      }

      const updatedProfile = { 
        ...profile, 
        encrypted_card_data: encrypted,
      };
      onProfileUpdate?.(updatedProfile);

      setStep('success');
      onCardSaved?.();
      toast.success('Card saved successfully');
    } catch (err: any) {
      console.error('Save card error:', err);
      toast.error(err?.message || 'Failed to save card');
      setStep('select');
    } finally {
      setIsSubmitting(false);
    }
  };

  const processStoredCardPayment = async () => {
    if (!userId) {
      toast.error('Please sign in to continue');
      return;
    }

    const selectedMethod = savedPaymentMethods.find(pm => pm.id === selectedPaymentMethodId) || savedPaymentMethods.find(pm => pm.is_default) || savedPaymentMethods[0];
    
    setIsSubmitting(true);
    setStep('processing');

    try {
      const { data, error } = await supabase.functions.invoke('charge-stored-card', {
        body: {
          userId,
          amountUsd,
          coins,
          packageId,
          packageName,
          purchaseType,
          paymentMethodId: selectedMethod?.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Payment failed');

      setPaymentResult(data);
      setStep('success');
      onPaymentSuccess?.(data);
    } catch (err: any) {
      console.error('Stored card payment error:', err);
      toast.error(err?.message || 'Payment failed. Please try again.');
      setStep('select');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!userId) {
      toast.error('Please sign in to continue');
      return;
    }

    setIsSubmitting(true);
    setStep('processing');

    try {
      // If saving card, encrypt and store
      let encryptedCardData: string | undefined;
      
      if (saveCard && !useSavedCard) {
        const cleanNumber = cardNumber.replace(/\s/g, '');
        const cardData: CardData = {
          cardNumber: cleanNumber,
          expiryMonth: cardExpiryMonth,
          expiryYear: cardExpiryYear,
          cvv: cardCvv,
          postalCode: cardPostalCode,
          cardholderName: cardHolderName,
        };
        encryptedCardData = await encryptCardData(cardData);
      }

      // Create Square checkout (works with or without stored card)
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

      // Save card if requested
      if (encryptedCardData) {
        await supabase
          .from('user_profiles')
          .update({ encrypted_card_data: encryptedCardData })
          .eq('id', userId);
        
        const updatedProfile = { ...profile, encrypted_card_data: encryptedCardData };
        onProfileUpdate?.(updatedProfile);
      }

      // Open Square payment page
      if (checkoutData?.paymentUrl) {
        const paymentWindow = window.open(checkoutData.paymentUrl, '_blank', 'width=600,height=700');
        
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

        setIsSubmitting(false);
        return;
      }

      setPaymentResult({ 
        orderId: checkoutData?.orderId, 
        amount: amountUsd,
      });
      setStep('success');
      onPaymentSuccess?.(paymentResult);

    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err?.message || 'Payment failed. Please try again.');
      setStep('select');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const groups = digits.match(/.{1,4}/g);
    return groups ? groups.join(' ') : digits;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleClose = () => {
    setStep('select');
    setUseSavedCard(hasSavedCard || false);
    setPaymentResult(null);
    onClose();
  };

  // Derive hasSavedCard from profile
  const hasExistingCard = Boolean(profile?.encrypted_card_data) || savedPaymentMethods.length > 0;

  if (!pkg) return null;

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
                : 'Payment complete!'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-4">
            {!saveOnly && hasExistingCard && (
              <div>
                {/* Package Summary */}
                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 mb-4">
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
                {savedPaymentMethods.length > 0 && (
                  <div className="space-y-2">
                    {savedPaymentMethods.map((method) => {
                      const isSelected = selectedPaymentMethodId === method.id;
                      return (
                        <div
                          key={method.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-purple-900/30 border-purple-500/50'
                              : 'bg-black/20 border-white/10 hover:border-purple-500/30'
                          }`}
                          onClick={() => {
                            setUseSavedCard(true);
                            setSelectedPaymentMethodId(method.id);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5 text-purple-400" />
                              <div>
                                <div className="font-semibold text-sm">{method.brand || 'Card'} •••• {method.last4}</div>
                                <div className="text-xs text-zinc-400">{method.provider === 'square' ? 'Cash App' : method.provider}</div>
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-zinc-500'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Legacy encrypted card display */}
                {savedPaymentMethods.length === 0 && decryptedCard && (
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
                          <div className="text-xs text-zinc-400">
                            {maskCardNumber(decryptedCard.cardNumber)}
                          </div>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${useSavedCard ? 'bg-purple-500 border-purple-500' : 'border-zinc-500'}`} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* New Card Form */}
            {(!useSavedCard || saveOnly) && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Cardholder Name</Label>
                  <Input
                    placeholder="Full Name"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Card Number</Label>
                  <Input
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    maxLength={19}
                    className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 ${
                      cardErrors.cardNumber ? 'border-red-500' : ''
                    }`}
                  />
                  {cardErrors.cardNumber && (
                    <p className="text-xs text-red-500">{cardErrors.cardNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label>Month</Label>
                    <Input
                      placeholder="MM"
                      value={cardExpiryMonth}
                      onChange={(e) => setCardExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      maxLength={2}
                      className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 ${
                        cardErrors.expiry ? 'border-red-500' : ''
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Year</Label>
                    <Input
                      placeholder="YY"
                      value={cardExpiryYear}
                      onChange={(e) => setCardExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      maxLength={2}
                      className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 ${
                        cardErrors.expiry ? 'border-red-500' : ''
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>CVV</Label>
                    <Input
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 ${
                        cardErrors.cvv ? 'border-red-500' : ''
                      }`}
                    />
                  </div>
                </div>
                {(cardErrors.expiry || cardErrors.cvv) && (
                  <p className="text-xs text-red-500">{cardErrors.expiry || cardErrors.cvv}</p>
                )}

                <div className="space-y-1">
                  <Label>Postal Code</Label>
                  <Input
                    placeholder="12345"
                    value={cardPostalCode}
                    onChange={(e) => setCardPostalCode(e.target.value)}
                    className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 ${
                      cardErrors.postalCode ? 'border-red-500' : ''
                    }`}
                  />
                  {cardErrors.postalCode && (
                    <p className="text-xs text-red-500">{cardErrors.postalCode}</p>
                  )}
                </div>

                {!saveOnly && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCard}
                      onChange={(e) => setSaveCard(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500"
                    />
                    <span className="text-sm text-zinc-400">
                      {requireCardOnFile
                        ? 'Card will be saved for future purchases'
                        : 'Save card for future purchases'}
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Lock className="w-3 h-3" />
              <span>Your card info is encrypted and stored securely.</span>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
            <p className="text-zinc-400">
              {saveOnly ? 'Saving card...' : 'Processing payment...'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-6 flex flex-col items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
            <p className="text-lg font-semibold text-white mb-2">
              {saveOnly ? 'Card Saved!' : 'Payment Successful!'}
            </p>
            <p className="text-zinc-400 text-sm">
              {saveOnly 
                ? 'Your card has been saved for future purchases.' 
                : `${coins?.toLocaleString()} coins have been added to your wallet.`}
            </p>
            {paymentResult?.orderId && (
              <p className="text-xs text-zinc-500 mt-2">Order: {paymentResult.orderId}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <div className="flex justify-end gap-2 w-full">
            {step === 'select' ? (
              <>
                <Button 
                  onClick={handleClose}
                  variant="outline"
                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveOnly ? handleSaveCard : handlePayment}
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveOnly ? (
                    'Save Card'
                  ) : (
                    `Pay $${amountUsd?.toFixed(2)}`
                  )}
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}