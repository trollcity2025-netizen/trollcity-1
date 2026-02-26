
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { UserRole } from '@/lib/supabase';
import { Shield, Star, Trophy, Users } from 'lucide-react';

const MaiTalentNav = () => {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === UserRole.ADMIN;

  const navItems = [
    { to: '/mai-talent/stage', label: 'Stage', icon: Star },
    { to: '/mai-talent/top10', label: 'Top 10', icon: Trophy },
    { to: '/mai-talent/training', label: 'Training', icon: Users },
  ];

  if (isAdmin) {
    navItems.push({ to: '/mai-talent/admin', label: 'Admin', icon: Shield });
  }

  return (
    <div className="w-full bg-slate-900/50 backdrop-blur-lg border-b border-white/10 mb-8">
      <div className="max-w-6xl mx-auto flex items-center justify-center p-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors ` +
              (isActive
                ? 'bg-purple-600/50 text-white shadow-lg'
                : 'text-slate-400 hover:bg-white/5 hover:text-white')
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default MaiTalentNav;
