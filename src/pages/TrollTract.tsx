import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Loader2, CheckCircle, XCircle, Crown, Zap, DollarSign, Users } from 'lucide-react';
import { purchaseTrolltract, fetchMyTrolltractStatus } from '../lib/trolltractApi';
import { toast } from 'sonner';

export function TrollTract() {
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [trolltractStatus, setTrolltractStatus] = useState(null);

  useEffect(() => {
    loadTrolltractStatus();
  }, []);

  const loadTrolltractStatus = async () => {
    try {
      setLoading(true);
      const data = await fetchMyTrolltractStatus();
      setTrolltractStatus(data);
    } catch (error) {
      console.error('Error loading TrollTract status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please log in to purchase TrollTract');
      return;
    }

    try {
      setPurchasing(true);
      const result = await purchaseTrolltract();
      
      if (result === 'success') {
        toast.success('TrollTract purchased successfully!');
        await refreshProfile();
        await loadTrolltractStatus();
        
        // Redirect to creator application after successful purchase
        setTimeout(() => {
          navigate('/creator-application');
        }, 2000);
      } else if (result === 'already_contracted') {
        toast.info('You already have a TrollTract contract!');
        // Redirect to application if not already submitted
        navigate('/creator-application');
      } else if (result === 'insufficient_funds') {
        toast.error('Insufficient funds. You need 20,000 paid coins.');
        // Redirect to coin store
        navigate('/coin-store');
      }
    } catch (error) {
      console.error('Error purchasing TrollTract:', error);
      toast.error('Failed to purchase TrollTract. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading TrollTract status...</span>
        </div>
      </div>
    );
  }

  // Already contracted
  if (trolltractStatus?.is_contracted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-950/60 border-slate-800 max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-50 mb-2">TrollTract Active!</h2>
            <p className="text-slate-300 mb-4">
              You have an active TrollTract contract. Complete your creator application to unlock benefits.
            </p>
            <Badge variant="outline" className="border-green-500 text-green-400 mb-4">
              Contract Level {trolltractStatus.contract_level}
            </Badge>
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/creator-application')}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Complete Creator Application
              </Button>
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="w-full border-slate-600 text-slate-300"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // TrollTract Purchase Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-slate-50">TrollTract Contract</h1>
          </div>
          <p className="text-slate-300 text-lg">
            Unlock your potential as a creator with exclusive benefits and earnings
          </p>
        </div>

        {/* Current Balance */}
        <Card className="bg-slate-950/60 border-slate-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400">Your Balance</p>
                <p className="text-2xl font-bold text-purple-400">
                  {(profile?.paid_coin_balance || 0).toLocaleString()} paid coins
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400">Required</p>
                <p className="text-xl font-bold text-slate-200">20,000 coins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Benefits */}
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                TrollTract Benefits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-200">10% Earnings Boost</h3>
                  <p className="text-slate-400 text-sm">Increase your coin earnings from all sources</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-yellow-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-200">Creator Status</h3>
                  <p className="text-slate-400 text-sm">Official creator badge and profile recognition</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-200">Community Access</h3>
                  <p className="text-slate-400 text-sm">Access to exclusive creator communities and features</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-purple-400 mt-1" />
                <div>
                  <h3 className="font-semibold text-slate-200">Priority Support</h3>
                  <p className="text-slate-400 text-sm">Fast-track support for creators</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Card */}
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-50">Activate TrollTract</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-400 mb-2">20,000</div>
                <p className="text-slate-300">Paid Coins Required</p>
                <p className="text-slate-400 text-sm mt-1">One-time purchase • Permanent benefits</p>
              </div>

              {(profile?.paid_coin_balance || 0) >= 20000 ? (
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="w-full bg-purple-600 hover:bg-purple-700 py-6 text-lg"
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5 mr-2" />
                      Activate TrollTract
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">
                      Insufficient funds. You need {(20000 - (profile?.paid_coin_balance || 0)).toLocaleString()} more coins.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/coin-store')}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Purchase Coins
                  </Button>
                </div>
              )}

              <div className="text-xs text-slate-400 text-center">
                By activating TrollTract, you agree to our Terms of Service and Creator Guidelines.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Process Flow */}
        <Card className="bg-slate-950/60 border-slate-800 mt-6">
          <CardHeader>
            <CardTitle className="text-slate-50">What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <h3 className="font-semibold text-slate-200 mb-2">Purchase Contract</h3>
                <p className="text-slate-400 text-sm">Pay 20,000 coins to activate your TrollTract contract</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">2</span>
                </div>
                <h3 className="font-semibold text-slate-200 mb-2">Submit Application</h3>
                <p className="text-slate-400 text-sm">Complete the creator onboarding application</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">3</span>
                </div>
                <h3 className="font-semibold text-slate-200 mb-2">Get Approved</h3>
                <p className="text-slate-400 text-sm">Wait for admin review and unlock all benefits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}