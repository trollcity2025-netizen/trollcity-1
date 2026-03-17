import React from 'react';
import { Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RolesTab(props: any) {
  const navigate = useNavigate();
  const roleHierarchy = [
    { role: 'President', level: 1, color: 'text-yellow-400', description: 'Highest authority, can use emergency powers' },
    { role: 'Lead Officer', level: 2, color: 'text-blue-400', description: 'Commands officer operations' },
    { role: 'Officer', level: 3, color: 'text-green-400', description: 'Enforces city laws' },
    { role: 'Secretary', level: 4, color: 'text-purple-400', description: 'Administrative duties' },
    { role: 'Citizen', level: 5, color: 'text-slate-400', description: 'Regular user' }
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Building2 className="text-yellow-400" />
          Roles & Power
        </h2>
        <p className="text-slate-400 mt-1">Government hierarchy and permissions</p>
      </div>
      
      <div className="space-y-4">
        {roleHierarchy.map((item) => (
          <div key={item.role} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`text-2xl font-bold ${item.color}`}>#{item.level}</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{item.role}</h3>
              <p className="text-slate-400 text-sm">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
