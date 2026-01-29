import React, { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Car, AlertTriangle, CheckCircle, Clock, Shield, XCircle, Gavel, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import DriversTest from './DriversTest';
import CarUpgradesModal from '@/components/CarUpgradesModal';

export default function TMVTab({ profile, isOwnProfile }: { profile: any, isOwnProfile: boolean }) {
   const { user, refreshProfile } = useAuthStore();
   const [takingTest, setTakingTest] = useState(false);
   const [loading, setLoading] = useState(false);

   if (!profile) return null;
   
   const licenseStatus = profile.drivers_license_status || 'none';
   const licenseExpiry = profile.drivers_license_expiry;
   const isExpired = licenseExpiry ? new Date(licenseExpiry) < new Date() : false;

   // Check if viewer is staff (Secretary or Admin)
   const isStaff = user && (user.role === 'admin' || user.role === 'secretary' || (user as any).is_admin);
   // Check if profile is admin (for infinite license)
   const isAdminProfile = profile.role === 'admin' || profile.is_admin;

   const handlePurchaseInsurance = async (carId: string) => {
     setLoading(true);
     try {
       const { error } = await supabase.rpc('purchase_insurance', { p_car_id: carId });
       if (error) throw error;
       toast.success('Insurance purchased!');
       await refreshProfile();
       // We also need to trigger a refresh of the profile being viewed if it's the same
       // But refreshProfile() only refreshes the logged in user. 
       // Profile.tsx handles real-time updates for the viewed profile, so it should be fine.
     } catch (e: any) {
       toast.error(e.message || 'Failed to purchase insurance');
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
       } catch (e: any) {
           toast.error(e.message || 'Action failed');
       } finally {
           setLoading(false);
       }
   };
   
   if (takingTest && isOwnProfile) {
      return <DriversTest onComplete={() => { setTakingTest(false); refreshProfile(); }} />;
   }

   return (
     <div className="space-y-6">
        {/* License Status */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
           <div className="flex justify-between items-start mb-4">
             <h3 className="text-lg font-bold flex items-center gap-2">
                 <Car className="text-purple-400" /> Driver's License
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
                      onClick={() => setTakingTest(true)}
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
              Insurance covers 30 days. Cost: 2000 Coins. Upgrades increase your vehicle's value.
           </p>
           
           <VehicleList 
             userId={profile.id} 
             onPurchaseInsurance={handlePurchaseInsurance} 
             loading={loading} 
             canPurchase={isOwnProfile}
           />
        </div>
     </div>
   );
}

function VehicleList({ userId, onPurchaseInsurance, loading, canPurchase }: { userId: string, onPurchaseInsurance: (id: string) => void, loading: boolean, canPurchase: boolean }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  
  React.useEffect(() => {
     if (!userId) return;
     loadVehicles();
  }, [userId]);

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('user_cars')
      .select('*')
      .eq('user_id', userId);
    if (data) setVehicles(data);
  };

  if (vehicles.length === 0) return <p className="text-gray-500">No vehicles owned.</p>;

  return (
    <>
      <CarUpgradesModal
        userCarId={selectedCarId!}
        onClose={() => {
          setSelectedCarId(null);
          loadVehicles();
        }}
        onUpdate={loadVehicles}
      />
      <div className="space-y-3">
         {vehicles.map(v => {
            const insuranceExpiry = v.insurance_expiry;
            const isInsured = insuranceExpiry && new Date(insuranceExpiry) > new Date();
            const currentValue = v.current_value || 0;
            
            return (
               <div key={v.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                  <div>
                     <p className="font-bold text-white capitalize">{v.car_id.replace(/_/g, ' ')} <span className="text-xs text-gray-500">({v.tier || 'Car'})</span></p>
                     <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-400">
                           {isInsured ? `Insured until ${new Date(insuranceExpiry).toLocaleDateString()}` : 'No Active Insurance'}
                        </p>
                        <p className="text-xs text-emerald-400 font-mono">
                          Value: {currentValue.toLocaleString()} coins
                        </p>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
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
