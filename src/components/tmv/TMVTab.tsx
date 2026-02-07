import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Car, AlertTriangle, CheckCircle, Shield, XCircle, Gavel, Wrench, Key } from 'lucide-react';
import { toast } from 'sonner';
import DriversTest from './DriversTest';
import TMVDrivingManual from './TMVDrivingManual';
import CarUpgradesModal from '@/components/CarUpgradesModal';

export default function TMVTab({ profile, isOwnProfile }: { profile: any, isOwnProfile: boolean }) {
   const { user, refreshProfile } = useAuthStore();
   const [takingTest, setTakingTest] = useState(false);
   const [showingManual, setShowingManual] = useState(false);
   const [loading, setLoading] = useState(false);

   if (!profile) return null;
   
   const licenseStatus = profile.drivers_license_status || 'none';
   const licenseExpiry = profile.drivers_license_expiry;
   const isExpired = licenseExpiry ? new Date(licenseExpiry) < new Date() : false;

   // Check if viewer is staff (Secretary or Admin)
   const isStaff = user && (user.role === 'admin' || user.role === 'secretary' || (user as any).is_admin);
   // Check if profile is admin (for infinite license)
   const isAdminProfile = profile.role === 'admin' || profile.is_admin;

   const handlePurchaseInsurance = async (vehicleId: string) => {
     setLoading(true);
     try {
       const { data, error } = await supabase.rpc('renew_vehicle_insurance', { p_vehicle_id: vehicleId });
       if (error) throw error;
       if (data && !data.success) {
         throw new Error(data.message);
       }
       toast.success('Insurance purchased!');
       // Trigger refresh in list via key or context if needed, but for now we rely on the list's own refresh
     } catch (e: any) {
       toast.error(e.message || 'Failed to purchase insurance');
     } finally {
       setLoading(false);
     }
   };

   const handleSetActive = async (vehicleId: string) => {
       setLoading(true);
       try {
           const { error } = await supabase
               .from('user_profiles')
               .update({ active_vehicle: vehicleId })
               .eq('id', profile.id);

           if (error) throw error;
           
           toast.success('Active vehicle updated!');
           if (isOwnProfile) {
               await refreshProfile();
           }
       } catch (e: any) {
           toast.error('Failed to set active vehicle');
           console.error(e);
       } finally {
           setLoading(false);
       }
   };

   const handleAdminAction = async (action: 'suspend' | 'revoke' | 'reinstate') => {
       if (!confirm(`Are you sure you want to ${action} this license?`)) return;
       setLoading(true);
       try {
           const { error } = await supabase.rpc('admin_suspend_license', { 
               p_target_user_id: profile.id,
               p_action: action
           });
           if (error) throw error;
           toast.success(`License ${action}ed`);
           refreshProfile(); 
       } catch (e: any) {
           toast.error(e.message || 'Action failed');
       } finally {
           setLoading(false);
       }
   };
   
   if (showingManual) {
      return <TMVDrivingManual onAcknowledge={() => { setShowingManual(false); setTakingTest(true); }} />;
   }

   if (takingTest && isOwnProfile) {
      return <DriversTest onComplete={() => { setTakingTest(false); refreshProfile(); }} />;
   }

   return (
     <div className="space-y-6">
        {/* License Status */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
           <div className="flex justify-between items-start mb-4">
             <h3 className="text-lg font-bold flex items-center gap-2">
                 <Car className="text-purple-400" /> Driver&apos;s License
             </h3>
             {isStaff && !isOwnProfile && (
                 <div className="flex gap-2">
                     {licenseStatus !== 'suspended' && (
                         <button 
                             onClick={() => handleAdminAction('suspend')}
                             className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded border border-red-700 flex items-center gap-1"
                         >
                             <Gavel size={12}/> Suspend
                         </button>
                     )}
                     {licenseStatus === 'suspended' && (
                         <button 
                             onClick={() => handleAdminAction('reinstate')}
                             className="px-3 py-1 bg-green-900/50 hover:bg-green-900 text-green-200 text-xs rounded border border-green-700"
                         >
                             Reinstate
                         </button>
                     )}
                 </div>
             )}
           </div>
           
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 {licenseStatus === 'active' && !isExpired ? (
                    <div className="w-16 h-10 bg-green-500/20 text-green-400 flex items-center justify-center rounded-lg border border-green-500/40">
                       <CheckCircle />
                    </div>
                 ) : licenseStatus === 'suspended' ? (
                    <div className="w-16 h-10 bg-red-500/20 text-red-400 flex items-center justify-center rounded-lg border border-red-500/40">
                       <XCircle />
                    </div>
                 ) : (
                    <div className="w-16 h-10 bg-yellow-500/20 text-yellow-400 flex items-center justify-center rounded-lg border border-yellow-500/40">
                       <AlertTriangle />
                    </div>
                 )}
                 
                 <div>
                    <p className="font-bold text-lg capitalize text-white">
                       {licenseStatus === 'none' ? 'No License' : licenseStatus}
                    </p>
                    {isAdminProfile ? (
                       <p className="text-sm text-blue-400" title="Admins never need to renew">
                         Expires: <span style={{fontFamily:'monospace', fontWeight:'bold'}}>∞</span> (Admin)
                       </p>
                    ) : licenseExpiry && (
                       <p className={`text-sm ${isExpired ? 'text-red-400' : 'text-gray-400'}`}>
                          Expires: {new Date(licenseExpiry).toLocaleDateString()}
                          {isExpired && ' (EXPIRED)'}
                       </p>
                    )}
                 </div>
              </div>
              
              <div>
                 {isOwnProfile && (licenseStatus === 'none' || isExpired) && licenseStatus !== 'suspended' && (
                  <button 
                    onClick={() => {
                      const seen = localStorage.getItem('tmv_driving_manual_acknowledged');
                      if (!seen) {
                        setShowingManual(true);
                      } else {
                        setTakingTest(true);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
                  >
                    {licenseStatus === 'none' ? 'Take Driver Test' : 'Renew License'}
                  </button>
               )}
                 {licenseStatus === 'suspended' && (
                    <span className="text-red-400 text-sm font-medium px-3 py-1 bg-red-900/20 rounded-lg border border-red-500/20">
                       Suspended by Court
                    </span>
                 )}
              </div>
           </div>
        </div>
        
        {/* Vehicles & Insurance */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
           <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="text-blue-400" /> Vehicle Insurance & Upgrades
           </h3>
           
           <p className="text-gray-400 text-sm mb-4">
              Insurance covers 30 days. Cost: 2000 Coins. Upgrades increase your vehicle&apos;s value.
           </p>
           
           <VehicleList 
             userId={profile.id} 
             onPurchaseInsurance={handlePurchaseInsurance} 
             loading={loading} 
             canPurchase={isOwnProfile}
             activeVehicleId={profile.active_vehicle}
             onSetActive={handleSetActive}
           />
        </div>
     </div>
   );
}

function VehicleList({ 
    userId, 
    onPurchaseInsurance, 
    loading, 
    canPurchase, 
    activeVehicleId,
    onSetActive 
}: { 
    userId: string, 
    onPurchaseInsurance: (id: string) => void, 
    loading: boolean, 
    canPurchase: boolean,
    activeVehicleId?: string,
    onSetActive: (id: string) => void
}) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh
  
  const loadVehicles = useCallback(async () => {
    // Join user_vehicles with vehicles_catalog and vehicle_insurance_policies
    // Note: Supabase JS select with joined tables
    const { data, error } = await supabase
      .from('user_vehicles')
      .select(`
        *,
        catalog:vehicles_catalog(*),
        insurance:vehicle_insurance_policies(*),
        registration:vehicle_registrations(*)
      `)
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Error loading vehicles:', error);
      return;
    }
    
    const formatted = data.map((v: any) => {
      // Find active insurance
      // Depending on Supabase response structure, insurance might be array or object
      const policies = Array.isArray(v.insurance) ? v.insurance : (v.insurance ? [v.insurance] : []);
      const activePolicy = policies.find((p: any) => p.status === 'active' && new Date(p.expires_at) > new Date());
      
      // Find registration
      const registrations = Array.isArray(v.registration) ? v.registration : (v.registration ? [v.registration] : []);
      const activeReg = registrations[0]; // Assuming one active registration or just taking the first one
      
      return {
        id: v.id,
        name: v.catalog?.name || 'Unknown Vehicle',
        tier: v.catalog?.tier || 'Standard',
        image: v.catalog?.image || v.catalog?.model_url, // Fallback to model_url if image is missing, though image is preferred
        insurance_expiry: activePolicy ? activePolicy.expires_at : null,
        plate: activeReg?.plate_number || 'TEMP',
        purchased_at: v.purchased_at
      };
    });

    setVehicles(formatted);
  }, [userId]);
  
  useEffect(() => {
     if (!userId) return;
     loadVehicles();
  }, [userId, loadVehicles, loading, refreshKey]); // Reload when loading state changes (after purchase)

  if (vehicles.length === 0) return <p className="text-gray-500">No vehicles owned.</p>;

  return (
    <>
      {selectedCarId && (
        <CarUpgradesModal
            userCarId={selectedCarId}
            onClose={() => {
            setSelectedCarId(null);
            setRefreshKey(prev => prev + 1);
            }}
            onUpdate={() => setRefreshKey(prev => prev + 1)}
        />
      )}
      <div className="space-y-3">
         {vehicles.map(v => {
            const insuranceExpiry = v.insurance_expiry;
            const isInsured = insuranceExpiry && new Date(insuranceExpiry) > new Date();
            const isActive = activeVehicleId === v.id;
            
            return (
               <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isActive ? 'bg-purple-900/20 border-purple-500/50' : 'bg-zinc-800 border-zinc-700'}`}>
                  <div className="flex items-center gap-4">
                     {v.image && (
                         <img src={v.image} alt={v.name} className="w-16 h-10 object-contain bg-black/50 rounded" />
                     )}
                     <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-white">{v.name} <span className="text-xs text-gray-500">({v.tier})</span></p>
                            {isActive && (
                                <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] uppercase font-bold rounded">Active</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-gray-400 font-mono bg-black/30 px-1 rounded">
                                {v.plate}
                            </p>
                            <p className={`text-xs ${isInsured ? 'text-green-400' : 'text-red-400'}`}>
                            {isInsured ? `Insured until ${new Date(insuranceExpiry).toLocaleDateString()}` : 'No Active Insurance'}
                            </p>
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     {canPurchase && !isActive && (
                         <button
                             onClick={() => onSetActive(v.id)}
                             disabled={loading}
                             className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-xs rounded font-medium flex items-center gap-1 text-zinc-200"
                             title="Set as Active Vehicle"
                         >
                             <Key size={12} /> Drive
                         </button>
                     )}
                     
                     {canPurchase && (
                       <button 
                         onClick={() => setSelectedCarId(v.id)}
                         className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-xs rounded font-medium flex items-center gap-1"
                       >
                         <Wrench size={12} /> Upgrades
                       </button>
                     )}
                     {canPurchase && !isInsured && (
                       <button 
                         onClick={() => onPurchaseInsurance(v.id)}
                         disabled={loading}
                         className="px-3 py-1 bg-green-600 hover:bg-green-700 text-xs rounded font-medium disabled:opacity-50"
                       >
                          Buy Insurance (2k)
                       </button>
                     )}
                     {isInsured && (
                       <span className="text-green-400 flex items-center gap-1 text-xs font-bold">
                          <Shield size={12} /> Protected
                       </span>
                     )}
                  </div>
               </div>
            );
         })}
      </div>
    </>
  );
}
