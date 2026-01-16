import React, { useEffect, useState, useRef } from 'react';
import { Car, Swords, Shield, Wrench, Heart, MapPin, ChevronDown, Radio, ArrowLeft } from 'lucide-react';
import { useGameNavigate } from './GameNavigation';
import { useGame } from './useGameContext';
import { useAuthStore } from '../../lib/store';
import { useLocation } from 'react-router-dom';

export default function GameControlPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDriveMenu, setShowDriveMenu] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const gameNavigate = useGameNavigate();
  const { isDriving } = useGame();
  const { user } = useAuthStore();
  const location = useLocation();
  const [hasCar, setHasCar] = useState(false);
   const [hasHouse, setHasHouse] = useState(false);
   const [hasCarInsurance, setHasCarInsurance] = useState(false);
  const [hasHomeInsurance, setHasHomeInsurance] = useState(false);
  const [isVehicleDamaged, setIsVehicleDamaged] = useState(false);
  const [hasDebuff, setHasDebuff] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const togglePanel = () => setIsOpen(!isOpen);

  const handleDragMove = (event: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    setDragOffset({
      x: state.originX + dx,
      y: state.originY + dy,
    });
  };

  const handleDragEnd = () => {
    dragStateRef.current = null;
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
  };

  const handleDragStart = (event: React.MouseEvent) => {
    event.preventDefault();
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    };
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  useEffect(() => {
    if (!user?.id) {
      setHasCar(false);
      setHasHouse(false);
      setHasCarInsurance(false);
      setHasHomeInsurance(false);
      setIsVehicleDamaged(false);
      setHasDebuff(false);
      return;
    }
    try {
      const carKey = `trollcity_car_${user.id}`;
      const homeKey = `trollcity_home_owned_${user.id}`;
      const carRaw = localStorage.getItem(carKey);
      const homeRaw = localStorage.getItem(homeKey);
      setHasCar(!!carRaw);
      setHasHouse(!!homeRaw);

      const carInsKey = `trollcity_car_insurance_${user.id}`;
      const homeInsKey = `trollcity_home_insurance_${user.id}`;
      const conditionKey = `trollcity_vehicle_condition_${user.id}`;
      const debuffKey = `trollcity_debuff_${user.id}`;

      const carInsRaw = localStorage.getItem(carInsKey);
      const homeInsRaw = localStorage.getItem(homeInsKey);
      const conditionRaw = localStorage.getItem(conditionKey);
      const debuffRaw = localStorage.getItem(debuffKey);

      let carInsured = false;
      if (carInsRaw) {
        try {
          const parsed = JSON.parse(carInsRaw);
          carInsured = !!parsed.active;
        } catch {
          carInsured = true;
        }
      }

      let homeInsured = false;
      if (homeInsRaw) {
        try {
          const parsed = JSON.parse(homeInsRaw);
          homeInsured = !!parsed.active;
        } catch {
          homeInsured = true;
        }
      }

      let damaged = false;
      if (conditionRaw) {
        try {
          const parsed = JSON.parse(conditionRaw);
          damaged = parsed.status !== 'good';
        } catch {
          damaged = false;
        }
      }

      let debuffActive = false;
      if (debuffRaw) {
        try {
          const parsed = JSON.parse(debuffRaw);
          debuffActive = !!parsed.active;
        } catch {
          debuffActive = false;
        }
      }

      setHasCarInsurance(carInsured);
      setHasHomeInsurance(homeInsured);
      setIsVehicleDamaged(damaged);
      setHasDebuff(debuffActive);
    } catch {
      setHasCar(false);
      setHasHouse(false);
      setHasCarInsurance(false);
      setHasHomeInsurance(false);
      setIsVehicleDamaged(false);
      setHasDebuff(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if ((hasCar || hasHouse) && !autoOpened) {
      setIsOpen(true);
      setShowDriveMenu(true);
      setAutoOpened(true);
    }
  }, [hasCar, hasHouse, autoOpened]);

  const canBuyInsurance =
    (hasCar && !hasCarInsurance) || (hasHouse && !hasHomeInsurance);
  const insuranceReason =
    !hasCar && !hasHouse
      ? 'Own a car or home to buy insurance'
      : 'Already insured';

  const canRepair = hasCar && isVehicleDamaged;
  const repairReason = !hasCar
    ? 'You need a vehicle first'
    : 'Vehicle is in good condition';

  const canVisitHospital = hasDebuff;

  const locations = [
    { label: 'Drive to Home', path: '/', visible: true },
    { label: 'Drive to Troll Town', path: '/trollstown', visible: true },
    { label: 'Drive to Car Dealership', path: '/dealership', visible: true },
    { label: 'Drive to Mechanic Shop', path: '/mechanic', visible: true },
    { label: 'Drive to General Store', path: '/general-store', visible: true },
    { label: 'Drive to Hospital', path: '/hospital', visible: true },
    { label: 'Drive to Coin Store', path: '/store', visible: true },
    { label: 'Drive to Marketplace', path: '/marketplace', visible: true },
    { label: 'Drive to Troll Mart', path: '/trollmart', visible: true },
    { label: 'Drive to Vehicle Auctions', path: '/auctions', visible: true },
    { label: 'Drive to Inventory', path: '/inventory', visible: true },
    { label: 'Drive to The Wall', path: '/wall', visible: true },
    { label: 'Drive to Leaderboard', path: '/leaderboard', visible: true },
  ].filter(loc => loc.visible);

  const showBackButton = locations.some(loc => 
    loc.path === location.pathname && 
    loc.path !== '/' && 
    loc.path !== '/trollstown'
  );

  const ActionButton = ({ icon: Icon, label, disabled, reason, onClick }: any) => (
    <div className="relative group w-full">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
          disabled
            ? 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
            : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600'
        }`}
      >
        <Icon size={20} />
        <span className="font-medium text-sm">{label}</span>
      </button>
      
      {/* Tooltip */}
      {disabled && reason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {reason}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
        </div>
      )}
    </div>
  );

  if (isDriving) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-40 flex flex-col items-end pointer-events-none"
      style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
    >
      {/* Expanded Panel */}
      {isOpen && (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-4 shadow-2xl mb-4 w-72 pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800 cursor-move"
            onMouseDown={handleDragStart}
          >
            <h3 className="font-bold text-zinc-200">Game Controls</h3>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Troll City OS</span>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            <div className="space-y-2">
                <ActionButton 
                    icon={Car} 
                    label="Drive to Location" 
                    onClick={() => setShowDriveMenu(!showDriveMenu)} 
                />
                
                {showDriveMenu && (
                    <div className="pl-4 space-y-1 border-l-2 border-zinc-800 ml-4">
                        {locations.map(loc => (
                            <button
                                key={loc.path}
                                onClick={() => {
                                    gameNavigate(loc.path);
                                    setIsOpen(false);
                                    setShowDriveMenu(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <MapPin size={14} />
                                {loc.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <ActionButton 
              icon={Swords} 
              label="Raid Property" 
              disabled 
              reason="Must be viewing a property" 
            />
            
            <ActionButton 
              icon={Radio} 
              label="Raid Broadcaster" 
              disabled 
              reason="Must be watching a live broadcast" 
            />

            <ActionButton 
              icon={Shield} 
              label="Buy Insurance" 
              disabled={!canBuyInsurance} 
              reason={insuranceReason} 
              onClick={() => {
                if (hasCar && !hasCarInsurance) {
                  gameNavigate('/dealership');
                } else if (hasHouse && !hasHomeInsurance) {
                  gameNavigate('/general-store');
                }
              }}
            />

            <ActionButton 
              icon={Wrench} 
              label="Pay Deductible" 
              disabled 
              reason="No active insurance claim" 
            />

            <ActionButton 
              icon={Wrench} 
              label="Repair Vehicle" 
              disabled={!canRepair} 
              reason={repairReason} 
              onClick={() => gameNavigate('/mechanic')}
            />

            <ActionButton 
              icon={Heart} 
              label="Visit Hospital" 
              disabled={!canVisitHospital} 
              reason="You are healthy" 
              onClick={() => gameNavigate('/hospital')}
            />
          </div>
        </div>
      )}

      {/* Back to Town Button */}
      {showBackButton && (
        <button
          onClick={() => gameNavigate('/trollstown')}
          className="pointer-events-auto mb-4 flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/30 transition-all active:scale-95 border-2 border-emerald-400/50 font-bold animate-in slide-in-from-right-10 fade-in duration-300"
        >
          <ArrowLeft size={20} />
          <span>Back to Town</span>
        </button>
      )}

      {/* Toggle Button */}
      <button
        onClick={togglePanel}
        className="pointer-events-auto flex items-center justify-center w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg shadow-purple-900/30 transition-all active:scale-95 border-2 border-purple-400/50"
      >
        {isOpen ? <ChevronDown size={28} /> : <Car size={28} />}
      </button>
    </div>
  );
}
