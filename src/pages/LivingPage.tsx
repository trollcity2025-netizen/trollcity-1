import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Home, Key, DollarSign, Building, Warehouse, Hotel, Tent, Briefcase, Edit2, X, Zap, Droplets } from 'lucide-react';

interface Property {
  id: string;
  name: string;
  type_id: string;
  rent_amount: number;
  utility_cost?: number; // Legacy field
  electric_cost?: number;
  water_cost?: number;
  owner_id: string | null;
  is_for_rent: boolean;
  is_for_sale: boolean;
  price: number;
  last_rent_change_at?: string;
}

interface Lease {
  id: string;
  property: Property;
  start_date: string;
  rent_due_day: number;
  last_rent_paid_at: string;
  status: string;
}

interface Loan {
  id: string;
  property: Property;
  amount: number; // total amount
  remaining_balance: number;
  loan_type: string;
  status: 'active' | 'paid' | 'defaulted';
  // calculated for UI
  monthly_payment: number; 
  next_payment_due_at: string;
}

export default function LivingPage() {
  const { user, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'my_home' | 'my_loans' | 'market' | 'landlord'>('my_home');
  const [marketFilter, setMarketFilter] = useState<'rent' | 'sale'>('rent');
  const [myLease, setMyLease] = useState<Lease | null>(null);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<(Property & { active_lease?: Lease & { tenant: { username: string } } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyingProp, setBuyingProp] = useState<Property | null>(null);
  const [downPayment, setDownPayment] = useState<string>('');
  const [isLandlord, setIsLandlord] = useState(false);
  
  // Landlord Edit State
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [editName, setEditName] = useState('');
  const [editRent, setEditRent] = useState('');

  useEffect(() => {
    if (user) {
      checkLandlordStatus();
      if (activeTab === 'my_home') fetchMyLease();
      if (activeTab === 'my_loans') fetchMyLoans();
      if (activeTab === 'market') fetchMarket();
      if (activeTab === 'landlord') fetchOwnedProperties();
    }
  }, [user, activeTab, marketFilter]);

  const checkLandlordStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('is_landlord')
      .eq('id', user.id)
      .single();
    
    if (data) setIsLandlord(data.is_landlord || false);
  };

  const fetchOwnedProperties = async () => {
    setLoading(true);
    // Fetch properties owned by user
    const { data: props, error } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', user?.id);

    if (props) {
      // For each property, fetch active lease if any
      const propsWithLease = await Promise.all(props.map(async (p) => {
        const { data: lease } = await supabase
          .from('leases')
          .select('*, tenant:user_profiles(username)')
          .eq('property_id', p.id)
          .eq('status', 'active')
          .maybeSingle();
        return { ...p, active_lease: lease };
      }));
      setOwnedProperties(propsWithLease);
    }
    setLoading(false);
  };

  const fetchMyLease = async () => {
    const { data, error } = await supabase
      .from('leases')
      .select('*, property:properties(*)')
      .eq('tenant_id', user?.id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (data) setMyLease(data);
    else setMyLease(null);
  };

  const fetchMyLoans = async () => {
    setLoading(true);
    // Note: 'bank_loans' is the table, but we need property details.
    // Ensure RLS allows reading properties even if not owner (public read is on).
    const { data, error } = await supabase
      .from('bank_loans')
      .select('*, property:properties(*)')
      .eq('user_id', user?.id)
      .eq('status', 'active');
    
    if (data) {
        // Map to Loan interface
        const loans = data.map((l: any) => ({
            ...l,
            // Mocking payment schedule for UI as it's not in DB yet
            monthly_payment: Math.ceil(l.amount / 50), 
            next_payment_due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }));
        setMyLoans(loans);
    }
    setLoading(false);
  };

  const fetchMarket = async () => {
    setLoading(true);
    
    // First, get IDs of active landlords
    const { data: landlords } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('is_landlord', true);
    
    const landlordIds = landlords?.map(l => l.id) || [];
    
    if (landlordIds.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }
    
    let query = supabase
      .from('properties')
      .select('*')
      .in('owner_id', landlordIds)
      .eq('is_for_rent', true)
      .limit(50);

    const { data: properties } = await query;
    
    if (properties) {
      // Filter out properties that have active leases
      const availableProperties = await Promise.all(properties.map(async (prop) => {
        const { data: lease } = await supabase
          .from('leases')
          .select('id')
          .eq('property_id', prop.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (!lease) {
          return prop;
        }
        return null;
      }));
      
      setProperties(availableProperties.filter((p): p is Property => p !== null));
    } else {
      setProperties([]);
    }
    setLoading(false);
  };

  const handleRent = async (propertyId: string, cost: number) => {
    if (!confirm(`Rent this property? Initial cost: ${cost} coins (Rent + Utilities)`)) return;
    
    try {
      const { data, error } = await supabase.rpc('sign_lease', { p_property_id: propertyId });
      
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success('Welcome home!');
      fetchMyLease();
      setActiveTab('my_home');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePayRent = async () => {
    if (!myLease) return;
    const total = myLease.property.rent_amount + (myLease.property.electric_cost ?? (myLease.property.utility_cost ?? 0) / 2) + (myLease.property.water_cost ?? (myLease.property.utility_cost ?? 0) / 2);
    if (!confirm(`Pay rent, electric, and water? Total: ${total} coins`)) return;

    try {
      const { data, error } = await supabase.rpc('pay_rent', { p_lease_id: myLease.id });
      
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success('Rent paid successfully!');
      fetchMyLease();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const initiateBuy = (prop: Property) => {
    setBuyingProp(prop);
    setDownPayment(Math.ceil(prop.price * 0.1).toString());
  };

  const handleBuyWithLoan = async () => {
    if (!buyingProp) return;
    const dp = parseInt(downPayment);
    if (isNaN(dp) || dp < buyingProp.price * 0.1) {
      toast.error('Down payment must be at least 10%');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('buy_property_with_loan', { 
        p_property_id: buyingProp.id,
        p_down_payment: dp
      });
      
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success('Property purchased successfully!');
      setBuyingProp(null);
      setActiveTab('my_loans');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePayLoan = async (loan: Loan) => {
    const amount = prompt(`How much to pay? (Remaining: ${loan.remaining_balance}, Weekly Due: ${loan.monthly_payment})`, loan.monthly_payment.toString());
    if (!amount) return;
    
    const payAmount = parseInt(amount);
    if (isNaN(payAmount) || payAmount <= 0) return;

    try {
      const { data, error } = await supabase.rpc('pay_loan', { 
        p_loan_id: loan.id,
        p_amount: payAmount
      });
      
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success('Loan payment successful!');
      fetchMyLoans();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBecomeLandlord = async () => {
    if (!confirm('Become a licensed landlord for 7,000 coins? This allows you to collect rent.')) return;

    try {
        const { data, error } = await supabase.rpc('purchase_landlord_license');
        if (error) throw error;
        if (data && !data.success) throw new Error(data.error);

        toast.success('You are now a licensed Landlord!');
        setIsLandlord(true);
        fetchOwnedProperties();
    } catch (err: any) {
        toast.error(err.message);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mansion': return <Hotel className="w-6 h-6 text-yellow-400" />;
      case 'house': return <Home className="w-6 h-6 text-blue-400" />;
      case 'apartment': return <Building className="w-6 h-6 text-green-400" />;
      case 'trailer': return <Warehouse className="w-6 h-6 text-orange-400" />;
      default: return <Tent className="w-6 h-6 text-gray-400" />;
    }
  };

  const canChangeRent = (property: Property) => {
    if (!property.last_rent_change_at) return true;
    const lastChange = new Date(property.last_rent_change_at);
    const daysSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange >= 30;
  };

  const getDaysUntilRentChange = (property: Property) => {
    if (!property.last_rent_change_at) return 0;
    const lastChange = new Date(property.last_rent_change_at);
    const daysSinceChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(30 - daysSinceChange));
  };

  const handleUpdateProperty = async () => {
    if (!editingProp) return;
    
    const newRent = parseInt(editRent);
    if (isNaN(newRent) || newRent < 0) {
      toast.error('Invalid rent amount');
      return;
    }

    // Check if rent changed and if allowed
    if (newRent !== editingProp.rent_amount && !canChangeRent(editingProp)) {
      toast.error('Rent can only be changed once every 30 days');
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .update({ 
          name: editName,
          rent_amount: newRent,
          last_rent_change_at: newRent !== editingProp.rent_amount ? new Date().toISOString() : editingProp.last_rent_change_at
        })
        .eq('id', editingProp.id);

      if (error) throw error;

      toast.success('Property updated successfully!');
      setEditingProp(null);
      fetchOwnedProperties();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-4 pb-20 md:pb-4 md:ml-64">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Home className="text-purple-500" /> Living & Housing
                </h1>
                <p className="text-gray-400 text-sm mt-1">Manage your residence, pay rent, or find a new home.</p>
            </div>
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => setActiveTab('my_home')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'my_home' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    My Home
                </button>
                <button 
                    onClick={() => setActiveTab('my_loans')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'my_loans' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    My Loans
                </button>
                <button 
                    onClick={() => setActiveTab('market')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'market' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Find Home
                </button>
                <button 
                    onClick={() => setActiveTab('landlord')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'landlord' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Landlord
                </button>
            </div>
        </header>

        {activeTab === 'landlord' && (
            <div className="space-y-6">
                {!isLandlord ? (
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-10 text-center">
                        <Briefcase className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Become a Landlord</h2>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            Purchase a Landlord License to start collecting rent from properties you own. 
                            As a landlord, you keep 90% of rent (10% tax).
                        </p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={handleBecomeLandlord}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                            >
                                <DollarSign className="w-5 h-5" />
                                Buy License (7,000 Coins)
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">My Properties</h2>
                        <div className="text-sm text-gray-400">
                            Total Monthly Income: <span className="text-green-400 font-bold">{ownedProperties.reduce((acc, p) => acc + (p.active_lease ? p.rent_amount : 0), 0).toLocaleString()}</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading properties...</div>
                    ) : ownedProperties.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p>You don't own any properties yet.</p>
                            <button onClick={() => { setActiveTab('market'); setMarketFilter('sale'); }} className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-bold">
                                Buy a property
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {ownedProperties.map(prop => (
                                <div key={prop.id} className="bg-[#1A1A24] border border-[#2C2C2C] rounded-xl p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            {getIcon(prop.type_id)}
                                            <div>
                                                <h3 className="font-bold text-white">{prop.name}</h3>
                                                <div className="text-xs text-gray-500 uppercase tracking-wider">{prop.type_id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    setEditingProp(prop);
                                                    setEditName(prop.name);
                                                    setEditRent(prop.rent_amount.toString());
                                                }}
                                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Edit Property"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${prop.active_lease ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {prop.active_lease ? 'RENTED' : 'VACANT'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-sm border-t border-white/5 pt-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Rent Price</span>
                                            <span className="text-white font-mono">{prop.rent_amount.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Electric Cost</span>
                                            <span className="text-white font-mono">{(prop.electric_cost ?? (prop.utility_cost ?? 0) / 2).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Water Cost</span>
                                            <span className="text-white font-mono">{(prop.water_cost ?? (prop.utility_cost ?? 0) / 2).toLocaleString()}</span>
                                        </div>
                                        
                                        {prop.active_lease ? (
                                            <div className="bg-green-500/10 rounded-lg p-3 mt-2 border border-green-500/20">
                                                <div className="text-xs text-green-400 mb-1 font-bold">CURRENT TENANT</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white">{prop.active_lease.tenant?.username || 'Unknown Tenant'}</span>
                                                    <span className="text-xs text-gray-400">Since {new Date(prop.active_lease.start_date).toLocaleDateString()}</span>
                                                </div>
                                                <div className="mt-2 text-xs flex justify-between border-t border-green-500/10 pt-2">
                                                    <span className="text-gray-400">Last Paid</span>
                                                    <span className="text-white">{prop.active_lease.last_rent_paid_at ? new Date(prop.active_lease.last_rent_paid_at).toLocaleDateString() : 'Never'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-yellow-500/5 rounded-lg p-3 mt-2 border border-yellow-500/10 text-center">
                                                <p className="text-yellow-200/70 text-xs">Property is currently empty.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    </>
                )}
            </div>
        )}

        {activeTab === 'my_loans' && (
            <div className="space-y-4">
                {myLoans.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">You have no active loans.</div>
                ) : (
                    myLoans.map(loan => (
                        <div key={loan.id} className="bg-[#1A1A24] border border-[#2C2C2C] rounded-xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {loan.property ? getIcon(loan.property.type_id) : <Building className="w-5 h-5" />}
                                        {loan.property ? loan.property.name : 'Unknown Property'}
                                    </h3>
                                    <p className="text-sm text-gray-400">Total Loan: {loan.amount.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Remaining</div>
                                    <div className="text-2xl font-bold text-red-400">{loan.remaining_balance.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div className="bg-black/20 p-3 rounded-lg">
                                    <div className="text-gray-500">Weekly Payment</div>
                                    <div className="font-mono text-white">{loan.monthly_payment.toLocaleString()}</div>
                                </div>
                                <div className="bg-black/20 p-3 rounded-lg">
                                    <div className="text-gray-500">Next Due</div>
                                    <div className="font-mono text-white">{new Date(loan.next_payment_due_at).toLocaleDateString()}</div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handlePayLoan(loan)}
                                className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold transition-colors"
                            >
                                Make Payment
                            </button>
                        </div>
                    ))
                )}
            </div>
        )}

        {activeTab === 'my_home' && (
            <div className="space-y-6">
                {!myLease ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-10 text-center">
                        <Tent className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">You are homeless!</h2>
                        <p className="text-gray-400 mb-6">You currently don't have a place to live. Check the market to find a home.</p>
                        <button 
                            onClick={() => setActiveTab('market')}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold transition-all"
                        >
                            Find a Home
                        </button>
                    </div>
                ) : (
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />
                        
                        <div className="flex items-start justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-zinc-800 rounded-xl border border-zinc-700">
                                    {getIcon(myLease.property.type_id)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">{myLease.property.name}</h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <span className="uppercase tracking-wider font-bold text-purple-400">{myLease.property.type_id}</span>
                                        <span>•</span>
                                        <span>Moved in: {new Date(myLease.start_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-400">Monthly Rent</div>
                                <div className="text-2xl font-bold text-white flex items-center justify-end gap-1">
                                    <DollarSign className="w-5 h-5 text-green-400" />
                                    {myLease.property.rent_amount.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">+ {(myLease.property.electric_cost ?? (myLease.property.utility_cost ?? 0) / 2).toLocaleString()} Electric + {(myLease.property.water_cost ?? (myLease.property.utility_cost ?? 0) / 2).toLocaleString()} Water</div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                <div className="text-sm text-gray-400 mb-1">Status</div>
                                <div className="font-medium text-green-400 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Active Lease
                                </div>
                            </div>
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm text-gray-400">Electric Company</span>
                                </div>
                                <div className="font-mono text-white">{(myLease.property.electric_cost ?? (myLease.property.utility_cost ?? 0) / 2).toLocaleString()} coins/mo</div>
                            </div>
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Droplets className="w-4 h-4 text-blue-400" />
                                    <span className="text-sm text-gray-400">Water Company</span>
                                </div>
                                <div className="font-mono text-white">{(myLease.property.water_cost ?? (myLease.property.utility_cost ?? 0) / 2).toLocaleString()} coins/mo</div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                <div className="text-sm text-gray-400 mb-1">Last Payment</div>
                                <div className="font-medium text-white">
                                    {myLease.last_rent_paid_at ? new Date(myLease.last_rent_paid_at).toLocaleDateString() : 'Never'}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 relative z-10">
                            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors">
                                Report Issue
                            </button>
                            <button 
                                onClick={handlePayRent}
                                className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-green-900/20"
                            >
                                Pay Rent
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'market' && (
            <div className="space-y-6">
                <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                    <button 
                        onClick={() => setMarketFilter('rent')}
                        className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-all ${marketFilter === 'rent' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        For Rent
                    </button>
                    <button 
                        onClick={() => setMarketFilter('sale')}
                        className={`text-sm font-bold pb-4 -mb-4 border-b-2 transition-all ${marketFilter === 'sale' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                        For Sale
                    </button>
                </div>

                {buyingProp && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#1A1A24] border border-[#2C2C2C] rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4">Buy {buyingProp.name}</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Price</span>
                                    <span className="font-bold">{buyingProp.price.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Min Down Payment (10%)</span>
                                    <span className="font-bold text-green-400">{Math.ceil(buyingProp.price * 0.1).toLocaleString()}</span>
                                </div>
                                
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Your Down Payment</label>
                                    <input 
                                        type="number"
                                        value={downPayment}
                                        onChange={(e) => setDownPayment(e.target.value)}
                                        className="w-full bg-black/30 border border-zinc-700 rounded-lg p-2 text-white"
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button 
                                        onClick={() => setBuyingProp(null)}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-2 rounded-lg font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleBuyWithLoan}
                                        className="flex-1 bg-purple-600 hover:bg-purple-500 py-2 rounded-lg font-bold"
                                    >
                                        Confirm Purchase
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {properties.map(prop => (
                        <div key={prop.id} className="bg-[#1A1A24] border border-[#2C2C2C] rounded-xl p-5 hover:border-purple-500/30 transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    {getIcon(prop.type_id)}
                                    <div>
                                        <h3 className="font-bold text-white">{prop.name}</h3>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider">{prop.type_id}</div>
                                    </div>
                                </div>
                                {marketFilter === 'sale' && (
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">Price</div>
                                        <div className="font-bold text-green-400">{prop.price?.toLocaleString()}</div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 text-sm border-t border-white/5 pt-3 mb-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Monthly Rent</span>
                                    <span className="text-white">{prop.rent_amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Electric</span>
                                    <span className="text-white">{(prop.electric_cost ?? (prop.utility_cost ?? 0) / 2).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Water</span>
                                    <span className="text-white">{(prop.water_cost ?? (prop.utility_cost ?? 0) / 2).toLocaleString()}</span>
                                </div>
                            </div>

                            {marketFilter === 'rent' ? (
                                <button 
                                    onClick={() => handleRent(prop.id, prop.rent_amount + (prop.electric_cost ?? (prop.utility_cost ?? 0) / 2) + (prop.water_cost ?? (prop.utility_cost ?? 0) / 2))}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Rent Now
                                </button>
                            ) : (
                                <button 
                                    onClick={() => initiateBuy(prop)}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Buy Property
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Edit Property Modal */}
        {editingProp && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1A1A24] border border-[#2C2C2C] rounded-2xl w-full max-w-md p-6 relative">
                    <button 
                        onClick={() => setEditingProp(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-purple-500" />
                        Edit Property
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Property Name</label>
                            <input 
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                placeholder="Enter property name"
                            />
                            <p className="text-xs text-gray-500 mt-1">This name is visible to everyone.</p>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Rent Amount (Coins)</label>
                            <input 
                                type="number"
                                value={editRent}
                                onChange={(e) => setEditRent(e.target.value)}
                                className={`w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 ${!canChangeRent(editingProp) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="Enter rent amount"
                            />
                            {!canChangeRent(editingProp) ? (
                                <p className="text-xs text-red-400 mt-1">
                                    Rent can only be changed once every 30 days. 
                                    Available in {getDaysUntilRentChange(editingProp)} days.
                                </p>
                            ) : (
                                <p className="text-xs text-green-400 mt-1">
                                    You can update the rent price now. Next update available in 30 days.
                                </p>
                            )}
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button 
                                onClick={() => setEditingProp(null)}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleUpdateProperty}
                                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl font-bold transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
