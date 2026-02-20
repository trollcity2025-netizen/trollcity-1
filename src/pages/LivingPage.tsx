import React, { useEffect, useState, useCallback } from 'react';

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Home, DollarSign, Building, Warehouse, Hotel, Tent, Briefcase, Edit2, X, Zap, Droplets, FileText, Calculator, CheckCircle, Trash2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  description?: string;
  image_url?: string;
  amenities?: string[];
  is_admin_created?: boolean; // Admin-created properties only landlords can buy
  is_landlord_purchased?: boolean; // Properties bought by landlords won't show in rent section
  max_tenants?: number;
  occupancy?: number; // Client-side calculated
}

interface Lease {
  id: string;
  property_id: string;
  property: Property;
  tenant_id: string;
  start_date: string;
  rent_due_day: number;
  last_rent_paid_at: string;
  status: string;
}

interface LandlordLoan {
  id: string;
  user_id: string;
  property_id: string;
  property?: Property;
  loan_amount: number;
  remaining_balance: number;
  monthly_payment: number;
  status: 'active' | 'paid' | 'defaulted';
  created_at: string;
}

interface LandlordApplication {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  business_plan: string;
  experience_years: number;
  has_startup_capital: boolean;
  created_at: string;
}

export default function LivingPage() {
  const { user, profile } = useAuthStore();
    const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my_home' | 'my_loans' | 'market' | 'landlord' | 'landlord_apply'>('my_home');
  const [marketFilter, setMarketFilter] = useState<'rent' | 'sale'>('rent');
  const [myLease, setMyLease] = useState<Lease | null>(null);
  const [myLoans, setMyLoans] = useState<LandlordLoan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<(Property & { active_lease?: Lease & { tenant: { username: string } } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [buyingProp, setBuyingProp] = useState<Property | null>(null);
  const [downPayment, setDownPayment] = useState<string>('');
  const [isLandlord, setIsLandlord] = useState(false);
  const [landlordApplication, setLandlordApplication] = useState<LandlordApplication | null>(null);
  
  // Landlord Application Form State
  const [showLandlordApplication, setShowLandlordApplication] = useState(false);
  const [useLoan, setUseLoan] = useState(false);
  const [creditScore, setCreditScore] = useState(0);
  const [landlordAppForm, setLandlordAppForm] = useState({
    business_plan: '',
    experience_years: 0,
    has_startup_capital: false,
    loan_amount_needed: 0,
    property_value_interest: 0,
  });

  useEffect(() => {
    if (user) {
                supabase.from('user_credit').select('score').eq('user_id', user.id).maybeSingle().then(({ data }) => {
            if (data) setCreditScore(data.score);
        });
    }
  }, [user]);
  
  // Loan Application State
  const [showLoanApplication, setShowLoanApplication] = useState(false);
  const [loanAppForm, setLoanAppForm] = useState({
    property_value: 0,
    loan_amount: 0,
    down_payment: 0,
    property_address: '',
    property_type: 'house',
  });
  
  // Landlord Edit State
  const [editingProp, setEditingProp] = useState<Property | null>(null);
  const [editName, setEditName] = useState('');
  const [editRent, setEditRent] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editIsForSale, setEditIsForSale] = useState(false);
  const [editMaxTenants, setEditMaxTenants] = useState(1);

  // Admin Property Creation State
  const [showAdminCreateProperty, setShowAdminCreateProperty] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPropertyForm, setAdminPropertyForm] = useState({
    name: '',
    type_id: 'house',
    rent_amount: 1500,
    price: 15000,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 500,
    electric_cost: 75,
    water_cost: 75,
    description: '',
    max_tenants: 1,
  });

  // Check admin status on mount
  useEffect(() => {
    if (profile) {
      const adminStatus = profile.role === 'admin' || profile.is_admin;
      setIsAdmin(adminStatus);
            if (adminStatus) {
                setIsLandlord(true);
            }
    }
  }, [profile]);

  const checkLandlordStatus = useCallback(async () => {
    if (!user) return;
        if (profile?.role === 'admin' || profile?.is_admin) {
            setIsLandlord(true);
            return;
        }
    const { data } = await supabase
      .from('user_profiles')
      .select('is_landlord')
      .eq('id', user.id)
            .maybeSingle();
    
    if (data) setIsLandlord(data.is_landlord || false);
    
    // Check for existing landlord application
    const { data: appData } = await supabase
      .from('landlord_applications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (appData) {
      setLandlordApplication(appData);
    }
  }, [user, profile?.is_admin, profile?.role]);

  // Landlord Application Handler
  const handleSubmitLandlordApplication = async () => {
    if (!user) return;
    
    if (!landlordAppForm.business_plan || landlordAppForm.experience_years < 0) {
      toast.error('Please complete all required fields');
      return;
    }

    if (useLoan && creditScore <= 650) {
        toast.error("Credit score must be > 650 for instant mortgage approval.");
        return;
    }
    
    try {
      // 1. Purchase License via RPC (handles cost/loan and status update)
      const { data: licenseData, error: licenseError } = await supabase.rpc('purchase_landlord_license', {
        p_use_loan: useLoan
      });

      if (licenseError) throw licenseError;
      if (licenseData && !licenseData.success) {
        throw new Error(licenseData.error || licenseData.message || 'Application denied');
      }

      // 2. Log Application (Optional, for records)
      await supabase
        .from('landlord_applications')
        .insert({
          user_id: user.id,
          status: 'approved', // Instant approval
          business_plan: landlordAppForm.business_plan,
          experience_years: landlordAppForm.experience_years,
          has_startup_capital: landlordAppForm.has_startup_capital,
          loan_amount_needed: landlordAppForm.loan_amount_needed,
          property_value_interest: landlordAppForm.property_value_interest,
          created_at: new Date().toISOString()
        });
      
      // 3. Create a new property for the new landlord (Bonus Starter Property)
      const propertyData = {
        name: `${user.user_metadata?.full_name || 'Landlord'}'s Apartment Complex`,
        address: `${100 + Math.floor(Math.random() * 900)} Landlord Lane`,
        type: 'apartment',
        bedrooms: 100,
        bathrooms: 50,
        sqft: 50000,
        price: 15000,
        is_for_sale: true,
        owner_id: user.id,
        tenant_capacity: 100,
        current_tenants: 0,
        max_tenants: 100,
        amenities: ['Parking', 'Laundry', 'Security', 'Pool', 'Gym'],
        image_url: '/api/placeholder/400/300',
        description: 'A spacious apartment complex with 100 units available for rent. Perfect for new landlords looking to start their rental business.'
      };
      
      const { error: propertyError } = await supabase
        .from('properties')
        .insert(propertyData);
      
      if (propertyError) {
        console.error('Error creating property:', propertyError);
        // Don't fail the whole process if property creation fails
      }
      
      toast.success('Landlord license purchased & application approved!');
      setIsLandlord(true);
      setLandlordApplication({
        id: 'new',
        user_id: user.id,
        status: 'approved',
        business_plan: landlordAppForm.business_plan,
        experience_years: landlordAppForm.experience_years,
        has_startup_capital: landlordAppForm.has_startup_capital,
        created_at: new Date().toISOString()
      });
      setShowLandlordApplication(false);
      setUseLoan(false);
      setActiveTab('market'); // Switch to market so they can buy their property
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Create property for existing landlords who don't have one
  const handleCreatePropertyForLandlords = async () => {
    if (!user || !isLandlord) {
      toast.error('You must be a landlord to use this feature');
      return;
    }
    
    try {
      // Check if current user already has a property
      const { data: existingProps } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);
      
      if (existingProps && existingProps.length > 0) {
        toast.info('You already have a property!');
        return;
      }
      
      // Create a new property for the landlord
      const propertyData = {
        name: `${user.user_metadata?.full_name || 'Landlord'}'s Apartment Complex`,
        address: `${100 + Math.floor(Math.random() * 900)} Landlord Lane`,
        type_id: 'apartment',
        rent_amount: 1500,
        utility_cost: 150,
        is_for_rent: true,
        is_for_sale: false,
        price: 15000,
        bedrooms: 100,
        bathrooms: 50,
        sqft: 50000,
        owner_id: user.id,
        tenant_capacity: 100,
        current_tenants: 0,
        amenities: ['Parking', 'Laundry', 'Security', 'Pool', 'Gym'],
        image_url: '/api/placeholder/400/300',
        description: 'A spacious apartment complex with 100 units available for rent. Perfect for landlords looking to expand their portfolio.'
      };
      
      const { error } = await supabase
        .from('properties')
        .insert(propertyData);
      
      if (error) throw error;
      
      toast.success('Property created! You can now rent out units to tenants.');
      fetchOwnedProperties();
      setActiveTab('my_home');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Admin: Create property for landlords to buy
  const handleAdminCreateProperty = async () => {
    if (!user || !isAdmin) {
      toast.error('Admin access required');
      return;
    }
    
    if (!adminPropertyForm.name || adminPropertyForm.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
        try {
            const isApartmentListing = adminPropertyForm.type_id === 'apartment';
            const isForRent = isApartmentListing;
            const isForSale = !isApartmentListing;

      const propertyData = {
        name: adminPropertyForm.name,
        type_id: adminPropertyForm.type_id,
        rent_amount: adminPropertyForm.rent_amount,
        price: adminPropertyForm.price,
        bedrooms: adminPropertyForm.bedrooms,
        bathrooms: adminPropertyForm.bathrooms,
        sqft: adminPropertyForm.sqft,
        electric_cost: adminPropertyForm.electric_cost,
        water_cost: adminPropertyForm.water_cost,
                is_for_sale: isForSale,
                is_for_rent: isForRent,
        is_admin_created: true, // Only landlords can buy this
        is_landlord_purchased: false,
        owner_id: null, // No owner yet, available for purchase
        tenant_capacity: adminPropertyForm.max_tenants, // Legacy support
        max_tenants: adminPropertyForm.max_tenants,
        current_tenants: 0,
        amenities: ['Basic Amenities'],
                description: adminPropertyForm.description || (isForRent ? 'A property available for rent.' : 'A property available for sale.'),
        image_url: '/api/placeholder/400/300',
      };
      
      const { error } = await supabase
        .from('properties')
        .insert(propertyData);
      
      if (error) throw error;
      
    toast.success(isForRent ? 'Property created for rent!' : 'Property created for sale!');
    setShowAdminCreateProperty(false);
    setActiveTab('market');
    setMarketFilter(isForRent ? 'rent' : 'sale');
    fetchMarket();
      
      // Reset form
      setAdminPropertyForm({
        name: '',
        type_id: 'house',
        rent_amount: 1500,
        price: 15000,
        bedrooms: 1,
        bathrooms: 1,
        sqft: 500,
        electric_cost: 75,
        water_cost: 75,
        description: '',
        max_tenants: 1,
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Loan Application Handler
  const handleSubmitLoanApplication = async () => {
    toast.error("This feature is being upgraded. Please find a property in the Market and use 'Buy with Loan'.");
    return;
    /* 
    Legacy implementation disabled to prevent data inconsistency
    if (!user) return;
    
    if (loanAppForm.loan_amount <= 0 || loanAppForm.property_value <= 0) {
    ...
    */
  };

  // Quick loan for property purchase
  const handleBuyWithLoan = async () => {
    if (!buyingProp || !user) return;
    
    if (creditScore <= 650) {
        toast.error("Credit score must be > 650 for instant loan approval.");
        return;
    }

    const propertyPrice = buyingProp.price;
    const calculatedDownPayment = parseInt((propertyPrice * 0.1).toString()); // 10% minimum
    
    try {
      // Use secure RPC for purchase
      // This handles: Balance check, Loan creation, Ownership transfer, Ledger logging
      const { data, error } = await supabase.rpc('buy_property_with_loan', {
        p_property_id: buyingProp.id,
        p_down_payment: calculatedDownPayment 
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Purchase failed');
      
      // Grant landlord status if not already (optimistic update, or fetch profile again)
      if (!isLandlord) {
         // The RPC doesn't update is_landlord automatically usually, but we can do it or check
         // We can trust the UI state for now or re-fetch
         checkLandlordStatus();
      }
      
      toast.success(`Property purchased with loan!`);
      setBuyingProp(null);
      setActiveTab('landlord');
      fetchOwnedProperties();
      fetchMyLoans();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Pay off loan with 40% auto-deduction to admin pool (Logic handled in RPC now)
  const handlePayLoan = async (loan: LandlordLoan) => {
    const amount = prompt(`Pay off mortgage? (Remaining: ${loan.remaining_balance.toLocaleString()} coins)`, loan.monthly_payment.toString());
    if (!amount) return;
    
    const payAmount = parseInt(amount);
    if (isNaN(payAmount) || payAmount <= 0) return;

    try {
      // Use secure RPC
      const { data, error } = await supabase.rpc('pay_bank_loan', {
        p_loan_id: loan.id,
        p_amount: payAmount
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Paid ${payAmount.toLocaleString()} coins!`);
        fetchMyLoans();
      } else {
        throw new Error(data?.error || 'Payment failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchOwnedProperties = useCallback(async () => {
    setLoading(true);
    // Fetch properties owned by user
    const { data: props, error: _error } = await supabase
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
  }, [user]);

  const fetchMyLease = useCallback(async () => {
    const { data, error: _error } = await supabase
      .from('leases')
      .select('*, property:properties(*)')
      .eq('tenant_id', user?.id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (data) setMyLease(data);
    else setMyLease(null);
  }, [user]);

  const fetchMyLoans = useCallback(async () => {
    setLoading(true);
    // Note: 'bank_loans' is the table, but we need property details.
    // Ensure RLS allows reading properties even if not owner (public read is on).
    const { data, error: _error } = await supabase
      .from('bank_loans')
      .select('*, property:properties(*)')
      .eq('user_id', user?.id)
      .eq('status', 'active');
    
    if (data) {
        // Map to Loan interface
        const loans = data.map((l: any) => ({
            ...l,
            loan_amount: l.amount, // Map bank_loans amount to UI interface
            // Mocking payment schedule for UI as it's not in DB yet
            monthly_payment: Math.ceil(l.amount / 50), 
            next_payment_due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }));
        setMyLoans(loans);
    }
    setLoading(false);
  }, [user]);

  const fetchMarket = useCallback(async () => {
    setLoading(true);
    
    // Determine which filter to use based on marketFilter state
    const isForSale = marketFilter === 'sale';
    
    try {
      if (isForSale) {
        // For sale: Show all properties for sale
        const { data: properties, error } = await supabase
          .from('properties')
          .select('*')
          .eq('is_for_sale', true)
          .limit(100);
        
        if (error) throw error;

        // Filter out own properties client-side to handle nulls correctly
        // and handle both owner_id and owner_user_id columns
        // const filteredProps = (properties || []).filter(p => {
        //   const ownerId = p.owner_id || p.owner_user_id;
        //   return ownerId !== user?.id;
        // });
        const filteredProps = properties || [];

        // Fetch owner names manually since join might fail
        const propsWithOwners = await Promise.all(filteredProps.map(async (p) => {
          const ownerId = p.owner_id || p.owner_user_id;
          if (!ownerId) return { ...p, owner: null };

          const { data: ownerProfile } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', ownerId)
            .maybeSingle();
          
          return { ...p, owner: ownerProfile };
        }));
        
        setProperties(propsWithOwners);
      } else {
        // For rent: Show all properties for rent
        
        // Fetch properties that are for rent
        // We do NOT filter by occupancy here because we want to show "1/100" etc.
        // The sign_lease RPC sets is_for_rent = false only when full, so relying on is_for_rent is safe for availability,
        // but we might want to show full properties too? 
        // For now, let's trust is_for_rent which is managed by the RPC.
        
        const { data: properties, error } = await supabase
          .from('properties')
          .select('*')
          .eq('is_for_rent', true)
          .limit(100);

        if (error) throw error;
        
        if (properties) {
          // Filter out own properties (optional but recommended)
          // const availableProperties = properties.filter(p => {
          //    const ownerId = p.owner_id || p.owner_user_id;
          //    return ownerId !== user?.id;
          // });
          const availableProperties = properties;

          // Fetch owner names and occupancy
          const propsWithDetails = await Promise.all(availableProperties.map(async (p) => {
            const ownerId = p.owner_id || p.owner_user_id;
            
            // Fetch Owner
            let ownerProfile = null;
            if (ownerId) {
                const { data } = await supabase
                    .from('user_profiles')
                    .select('username')
                    .eq('id', ownerId)
                    .maybeSingle();
                ownerProfile = data;
            }

            // Fetch Occupancy
            const { count } = await supabase
                .from('leases')
                .select('*', { count: 'exact', head: true })
                .eq('property_id', p.id)
                .eq('status', 'active');

            return { 
                ...p, 
                owner: ownerProfile,
                occupancy: count || 0,
                max_tenants: p.max_tenants || 1
            };
          }));
          
          setProperties(propsWithDetails);
        } else {
          setProperties([]);
        }
      }
    } catch (error: any) {
        console.error('Error fetching market properties:', error);
        toast.error('Failed to load properties');
        setProperties([]);
    } finally {
        setLoading(false);
    }
  }, [marketFilter]);

    useEffect(() => {
        if (activeTab === 'market') {
            fetchMarket();
        }
    }, [activeTab, fetchMarket]);

  const handleDeleteProperty = async (propertyId: string) => {
    if (!isAdmin) return;
    
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      toast.success('Property deleted successfully');
      fetchMarket();
    } catch (err: any) {
      toast.error('Error deleting property: ' + err.message);
    }
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

    // Validate sale price if marked for sale
    if (editIsForSale) {
      const salePrice = parseInt(editSalePrice);
      if (isNaN(salePrice) || salePrice <= 0) {
        toast.error('Please set a valid sale price');
        return;
      }
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
          is_for_sale: editIsForSale,
          price: editIsForSale ? parseInt(editSalePrice) : editingProp.price,
          last_rent_change_at: newRent !== editingProp.rent_amount ? new Date().toISOString() : editingProp.last_rent_change_at,
          max_tenants: editMaxTenants
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
            <div className="flex items-center gap-3">
                {/* Admin Create Property Button */}
                {isAdmin && (
                    <button
                        onClick={() => setShowAdminCreateProperty(true)}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                    >
                        <Building className="w-4 h-4" />
                        Create Property
                    </button>
                )}
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
                        My Mortgages
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
            </div>
        </header>

        {activeTab === 'landlord' && (
            <div className="space-y-6">
                {!isLandlord ? (
                    <>
                        {/* Landlord Application Form */}
                        {showLandlordApplication || landlordApplication?.status === 'pending' ? (
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-8">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                                    <FileText className="w-6 h-6 text-yellow-500" />
                                    Landlord Application
                                </h2>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">
                                            Business Plan / Why do you want to be a landlord?
                                        </label>
                                        <textarea
                                            value={landlordAppForm.business_plan}
                                            onChange={(e) => setLandlordAppForm(prev => ({ ...prev, business_plan: e.target.value }))}
                                            className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 h-32"
                                            placeholder="Describe your business plan..."
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Years of Experience</label>
                                            <input
                                                type="number"
                                                value={landlordAppForm.experience_years}
                                                onChange={(e) => setLandlordAppForm(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Loan Amount Needed</label>
                                            <input
                                                type="number"
                                                value={landlordAppForm.loan_amount_needed}
                                                onChange={(e) => setLandlordAppForm(prev => ({ ...prev, loan_amount_needed: parseInt(e.target.value) || 0 }))}
                                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={landlordAppForm.has_startup_capital}
                                                onChange={(e) => setLandlordAppForm(prev => ({ ...prev, has_startup_capital: e.target.checked }))}
                                                className="w-4 h-4 rounded border-zinc-700 bg-black/30 cursor-pointer accent-yellow-500"
                                            />
                                            I have startup capital available
                                        </label>
                                    </div>

                                    {/* License Fee & Loan Option */}
                                    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 mt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm text-gray-300">Landlord License Fee</span>
                                            <span className="text-yellow-400 font-mono font-bold">7,000 TC</span>
                                        </div>

                                        {creditScore > 650 && (
                                            <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="w-4 h-4 text-emerald-400" />
                                                    <span className="text-gray-300 text-sm">Instant Mortgage (10% Down)</span>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={useLoan} 
                                                        onChange={(e) => setUseLoan(e.target.checked)} 
                                                        className="sr-only peer" 
                                                    />
                                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                                                </label>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-end mt-3 pt-3 border-t border-white/10">
                                            <div className="text-sm text-gray-400">Total Due Now</div>
                                            <div className="text-xl font-bold text-yellow-400 font-mono">
                                                {useLoan ? '700' : '7,000'} TC
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            onClick={() => setShowLandlordApplication(false)}
                                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmitLandlordApplication}
                                            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Submit Application
                                        </button>
                                    </div>
                                    
                                    <p className="text-xs text-gray-500 text-center mt-4">
                                        Applications are instantly approved. You can start buying properties immediately.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-10 text-center">
                                <Briefcase className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-white mb-2">Become a Landlord</h2>
                                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                                    Complete a landlord application to start collecting rent from properties you own. 
                                    Loans are available to help you purchase properties!
                                </p>
                                <div className="flex justify-center gap-4">
                                    <button 
                                        onClick={() => setShowLandlordApplication(true)}
                                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                                    >
                                        <FileText className="w-5 h-5" />
                                        Apply Now
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
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
                            <p>You don&apos;t own any properties yet.</p>
                            <div className="flex justify-center gap-3 mt-4">
                                <button 
                                    onClick={handleCreatePropertyForLandlords}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Create Your Property
                                </button>
                                <button onClick={() => { setActiveTab('market'); setMarketFilter('sale'); }} className="text-purple-400 hover:text-purple-300 text-sm font-bold">
                                    Buy a property
                                </button>
                            </div>
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
                                                    setEditSalePrice(prop.price?.toString() || '');
                                                    setEditIsForSale(prop.is_for_sale || false);
                                                    setEditMaxTenants(prop.max_tenants || 1);
                                                }}
                                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Edit Property"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <div className={`px-2 py-1 rounded text-xs font-bold ${prop.occupancy && prop.occupancy > 0 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {prop.occupancy && prop.occupancy > 0 ? `${prop.occupancy}/${prop.max_tenants || 1}` : 'VACANT'}
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
                                        
                                        {prop.occupancy && prop.occupancy > 0 ? (
                                            <div className="bg-green-500/10 rounded-lg p-3 mt-2 border border-green-500/20">
                                                <div className="text-xs text-green-400 mb-1 font-bold">OCCUPANCY</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white">
                                                        {prop.max_tenants && prop.max_tenants > 1 
                                                            ? `${prop.occupancy} / ${prop.max_tenants} Tenants`
                                                            : (prop.active_lease?.tenant?.username || 'Unknown Tenant')}
                                                    </span>
                                                    {(!prop.max_tenants || prop.max_tenants === 1) && prop.active_lease && (
                                                        <span className="text-xs text-gray-400">Since {new Date(prop.active_lease.start_date).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                                {(!prop.max_tenants || prop.max_tenants === 1) && prop.active_lease && (
                                                    <div className="mt-2 text-xs flex justify-between border-t border-green-500/10 pt-2">
                                                        <span className="text-gray-400">Last Paid</span>
                                                        <span className="text-white">{prop.active_lease.last_rent_paid_at ? new Date(prop.active_lease.last_rent_paid_at).toLocaleDateString() : 'Never'}</span>
                                                    </div>
                                                )}
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
                {/* Loan Application Button */}
                {isLandlord && (
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-600/20 rounded-xl">
                                    <Calculator className="w-6 h-6 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Need a Loan?</h3>
                                    <p className="text-sm text-gray-400">Get instant approval for property loans</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowLoanApplication(true)}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-xl font-bold transition-colors"
                            >
                                Apply for Loan
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Loan Application Form */}
                {showLoanApplication && (
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-yellow-500" />
                            Mortgage Application
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Property Value</label>
                                <input
                                    type="number"
                                    value={loanAppForm.property_value || ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setLoanAppForm(prev => ({
                                            ...prev,
                                            property_value: val,
                                            down_payment: Math.ceil(val * 0.1),
                                            loan_amount: val - Math.ceil(val * 0.1)
                                        }));
                                    }}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Property value"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Property Type</label>
                                <select
                                    value={loanAppForm.property_type}
                                    onChange={(e) => setLoanAppForm(prev => ({ ...prev, property_type: e.target.value }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                >
                                    <option value="house">House</option>
                                    <option value="apartment">Apartment</option>
                                    <option value="mansion">Mansion</option>
                                    <option value="trailer">Trailer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Down Payment (10% min)</label>
                                <input
                                    type="number"
                                    value={loanAppForm.down_payment || ''}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setLoanAppForm(prev => ({
                                            ...prev,
                                            down_payment: val,
                                            loan_amount: Math.max(0, (prev.property_value || 0) - val)
                                        }));
                                    }}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Down payment"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Mortgage Amount</label>
                                <input
                                    type="number"
                                    value={loanAppForm.loan_amount || ''}
                                    readOnly
                                    className="w-full bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                                    placeholder="Mortgage amount"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Property Value:</span>
                                <span className="text-white font-mono">{loanAppForm.property_value.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Down Payment (10%):</span>
                                <span className="text-yellow-400 font-mono">{loanAppForm.down_payment.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Loan Amount:</span>
                                <span className="text-green-400 font-mono">{loanAppForm.loan_amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Weekly Payment (50 weeks):</span>
                                <span className="text-white font-mono">{Math.ceil(loanAppForm.loan_amount / 50).toLocaleString()}</span>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowLoanApplication(false)}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitLoanApplication}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold transition-colors"
                            >
                                Get Approved
                            </button>
                        </div>
                    </div>
                )}
                
                {myLoans.length === 0 && !showLoanApplication ? (
                    <div className="text-center py-10 text-gray-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p>You have no active loans.</p>
                    </div>
                ) : (
                    myLoans.map(loan => (
                        <div key={loan.id} className="bg-[#1A1A24] border border-[#2C2C2C] rounded-xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        {loan.property ? getIcon(loan.property.type_id) : <Building className="w-5 h-5" />}
                                        {loan.property?.name || 'Property Loan'}
                                    </h3>
                                    <p className="text-sm text-gray-400">Total Loan: {loan.loan_amount.toLocaleString()}</p>
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
                                    <div className="text-gray-500">Status</div>
                                    <div className={`font-mono ${loan.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {loan.status.toUpperCase()}
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => handlePayLoan(loan)}
                                disabled={loan.status === 'paid'}
                                className={`w-full py-2 rounded-lg font-bold transition-colors ${loan.status === 'paid' ? 'bg-zinc-700 text-gray-500' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {loan.status === 'paid' ? 'Loan Paid Off' : 'Make Payment'}
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
                        <p className="text-gray-400 mb-6">You currently don&apos;t have a place to live. Check the market to find a home.</p>
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
                            <button
                                onClick={() => navigate('/support')}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
                            >
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
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProperty(prop.id);
                                            }}
                                            className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete Property"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    {marketFilter === 'sale' ? (
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Price</div>
                                            <div className="font-bold text-green-400">{prop.price?.toLocaleString()}</div>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Occupancy</div>
                                            <div className={`font-bold ${prop.occupancy && prop.occupancy >= (prop.max_tenants || 1) ? 'text-red-400' : 'text-green-400'}`}>
                                                {prop.occupancy || 0}/{prop.max_tenants || 1}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                    disabled={prop.occupancy !== undefined && prop.max_tenants !== undefined && prop.occupancy >= prop.max_tenants}
                                    className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                                        prop.occupancy !== undefined && prop.max_tenants !== undefined && prop.occupancy >= prop.max_tenants
                                            ? 'bg-zinc-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                    }`}
                                >
                                    {prop.occupancy !== undefined && prop.max_tenants !== undefined && prop.occupancy >= prop.max_tenants ? 'Fully Occupied' : 'Rent Now'}
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

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Max Tenants</label>
                            <input 
                                type="number"
                                value={editMaxTenants}
                                onChange={(e) => setEditMaxTenants(parseInt(e.target.value) || 1)}
                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                placeholder="Max Tenants"
                            />
                            <p className="text-xs text-gray-500 mt-1">Maximum number of tenants allowed.</p>
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

        {/* Admin Create Property Modal */}
        {showAdminCreateProperty && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="bg-[#1A1A24] border border-[#2C2C2C] rounded-2xl w-full max-w-lg p-6 relative">
                    <button 
                        onClick={() => setShowAdminCreateProperty(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Building className="w-5 h-5 text-red-500" />
                        Create Property Listing
                    </h3>
                    <p className="text-sm text-gray-400 mb-6">
                        Apartments appear in &quot;For Rent&quot;. All other types appear in &quot;For Sale&quot;.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Property Name</label>
                            <input 
                                type="text"
                                value={adminPropertyForm.name}
                                onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                placeholder="Enter property name"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Property Type</label>
                                <select
                                    value={adminPropertyForm.type_id}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, type_id: e.target.value }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                >
                                    <option value="house">House</option>
                                    <option value="apartment">Apartment</option>
                                    <option value="mansion">Mansion</option>
                                    <option value="trailer">Trailer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Sale Price</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.price}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Sale price"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Monthly Rent</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.rent_amount}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, rent_amount: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Rent amount"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Bedrooms</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.bedrooms}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, bedrooms: parseInt(e.target.value) || 1 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Bathrooms</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.bathrooms}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, bathrooms: parseInt(e.target.value) || 1 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Square Feet</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.sqft}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, sqft: parseInt(e.target.value) || 500 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Max Tenants</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.max_tenants}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, max_tenants: parseInt(e.target.value) || 1 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Electric Cost</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.electric_cost}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, electric_cost: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Electric cost"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Water Cost</label>
                                <input 
                                    type="number"
                                    value={adminPropertyForm.water_cost}
                                    onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, water_cost: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Water cost"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Description</label>
                            <textarea
                                value={adminPropertyForm.description}
                                onChange={(e) => setAdminPropertyForm(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 h-20"
                                placeholder="Property description..."
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button 
                                onClick={() => setShowAdminCreateProperty(false)}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleAdminCreateProperty}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-xl font-bold transition-colors"
                            >
                                Create Property
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
