import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';

export default function AccountWallet() {
  const { user } = useAuthStore();
  const [cardNumber, setCardNumber] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [savedMethods, setSavedMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch saved cards on load
  useEffect(() => {
    if (!user) return;
    fetchSavedCards();
  }, [user]);

  const fetchSavedCards = async () => {
    const { data, error } = await supabase
      .from('user_payment_methods')
      .select('id, provider, display_name, brand, last4, is_default, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      toast.error('Failed to load saved payment methods');
    } else {
      setSavedMethods(data || []);
    }
  };

  const handleRemove = async (id: string) => {
    if (!user) return
    setLoading(true)
    const backup = savedMethods
    setSavedMethods(prev => prev.filter(m => m.id !== id))
    try {
      const { error } = await supabase
        .from('user_payment_methods')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Delete failed', error)
        setSavedMethods(backup)
        toast.error(error?.message || 'Failed to remove payment method')
      } else {
        toast.success('Payment method removed')
        fetchSavedCards()
      }
    } catch (e) {
      console.error(e)
      setSavedMethods(backup)
      toast.error('Failed to remove payment method')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCard = async () => {
    if (!cardNumber || !exp || !cvv || !zipCode) {
      toast.error('Please complete all fields including ZIP code');
      return;
    }

    // Validate ZIP code (5 digits for US)
    if (!/^\d{5}$/.test(zipCode)) {
      toast.error('Please enter a valid 5-digit ZIP code');
      return;
    }

    setLoading(true);
    const last4 = cardNumber.slice(-4);
    try {
      // In development we create a mock token; in production, use Square Web Payments SDK
      const cardToken = `mock_${last4}`
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token || ''
      const res = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/square/save-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ 
          userId: user.id, 
          cardToken, 
          saveAsDefault: false,
          postalCode: zipCode,
          cardDetails: {
            number: cardNumber,
            exp,
            cvv
          }
        })
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('Save card failed', j)
        toast.error(j?.error || 'Failed to save card')
      } else {
        toast.success('Card saved successfully!')
        if (j?.method) {
          setSavedMethods(prev => [j.method, ...prev])
        }
        setCardNumber('')
        setExp('')
        setCvv('')
        setZipCode('')
        await fetchSavedCards()
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to save card')
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto text-white">
      <h2 className="text-xl font-bold mb-4">Wallet & Payments</h2>
      <div className="mb-6">
        <label className="block text-sm mb-1">Account Email</label>
        <input
          value={user?.email || ''}
          disabled
          className="w-full bg-[#121212] border border-gray-700 p-2 rounded"
        />
      </div>

      {/* Single Card Form */}
      <div className="space-y-4 mb-4 bg-[#0d0d0d] p-4 rounded border border-gray-700">
        <div className="text-sm text-gray-400 mb-2">
          💳 Add your debit or credit card
        </div>
        <input
          type="text"
          placeholder="Card number"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
          maxLength={16}
          className="w-full p-2 rounded bg-[#121212] border border-gray-600"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="MM/YY"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            maxLength={5}
            className="w-1/3 p-2 rounded bg-[#121212] border border-gray-600"
          />
          <input
            type="password"
            placeholder="CVV"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
            maxLength={4}
            className="w-1/3 p-2 rounded bg-[#121212] border border-gray-600"
          />
          <input
            type="text"
            placeholder="ZIP Code"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, ''))}
            maxLength={5}
            className="w-1/3 p-2 rounded bg-[#121212] border border-gray-600"
          />
        </div>
        <button
          onClick={handleSaveCard}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded font-semibold disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Debit Card'}
        </button>
      </div>

      <h3 className="text-lg font-semibold mt-6 mb-2">Linked Payment Methods</h3>
      {savedMethods.length === 0 ? (
        <p>No methods linked.</p>
      ) : (
        <div className="space-y-3">
          {savedMethods.map((method) => (
            <div
              key={method.id}
              className="bg-[#1a1a1a] p-3 rounded border border-gray-700 flex items-center justify-between"
            >
              <div>
                <span>
                  {method.provider === 'card' ? `💳 ${method.brand} ending in ${method.last4}` : method.display_name || method.provider}
                  {method.is_default ? ' (default)' : ''}
                </span>
                <div className="text-sm text-gray-400">
                  Added {new Date(method.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <button
                  onClick={() => handleRemove(method.id)}
                  className="px-3 py-1 bg-gray-700 rounded text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
