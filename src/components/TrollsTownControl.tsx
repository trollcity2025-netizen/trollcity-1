import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Car, 
  Wrench, 
  Heart, 
  ShoppingCart, 
  Shield, 
  Map,
  X,
  Store,
  Coins,
  Users,
  Briefcase,
  Scale,

} from 'lucide-react';
import { useCity3DStore } from '../lib/stores/cityScene3D';

interface TrollsTownControlProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrollsTownControl({ isOpen, onClose }: TrollsTownControlProps) {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<'town' | 'services' | 'shopping'>('town');
  const { } = useCity3DStore();

  // Close menu with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const townLocations = [
    { icon: Home, label: 'Trolls Town', path: '/trolls-town', color: 'text-purple-400' },
    { icon: Map, label: 'Living', path: '/living', color: 'text-blue-400' },

    { icon: Wrench, label: 'Mechanic', path: '/tmv', color: 'text-orange-400' },
    { icon: Heart, label: 'Hospital', path: '/troller-insurance', color: 'text-red-400' },
    { icon: Shield, label: 'Insurance', path: '/troller-insurance', color: 'text-green-400' },
  ];

  const services = [
    { icon: Coins, label: 'Troll Bank', path: '/troll-bank', color: 'text-yellow-400' },
    { icon: Scale, label: 'Court', path: '/troll-court', color: 'text-amber-400' },
    { icon: Briefcase, label: 'Career', path: '/career', color: 'text-cyan-400' },
    { icon: Users, label: 'Officers', path: '/troll-officer-lounge', color: 'text-indigo-400' },
  ];

  const shopping = [
    { icon: Store, label: 'Marketplace', path: '/marketplace', color: 'text-pink-400' },
    { icon: ShoppingCart, label: 'Coin Store', path: '/coin-store', color: 'text-rose-400' },
    { icon: Home, label: 'Shop', path: '/shop', color: 'text-violet-400' },
    { icon: Car, label: 'Auctions', path: '/auctions', color: 'text-teal-400' },
  ];

  const currentItems = activeCategory === 'town' ? townLocations : activeCategory === 'services' ? services : shopping;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0A0A0F] border border-purple-500/30 rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.3)] w-[500px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Map className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Trolls Town</h2>
              <p className="text-xs text-gray-400">Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-purple-300">ESC</kbd> to close</p>
            </div>
          </div>
          

          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-1 px-4 py-3 bg-black/20 border-b border-white/5">
          <button
            onClick={() => setActiveCategory('town')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === 'town'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Town
          </button>
          <button
            onClick={() => setActiveCategory('services')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === 'services'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveCategory('shopping')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === 'shopping'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Shopping
          </button>
        </div>

        {/* Locations Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {currentItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
                className="flex items-center gap-3 p-4 bg-[#12121A] rounded-xl border border-white/5 hover:border-purple-500/30 hover:bg-[#1A1A25] transition-all group"
              >
                <div className={`p-2.5 rounded-lg bg-[#1A1A25] group-hover:scale-110 transition-transform ${item.color}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-gray-200 font-medium group-hover:text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/20 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Trolls Town Navigation</span>
            <div className="flex items-center gap-4">
              <span>Quick access to all locations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
