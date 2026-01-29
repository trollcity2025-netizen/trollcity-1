import React, { useState } from 'react';
import { X, Car, Home, Calendar, User, Tag, FileText } from 'lucide-react';

interface TitleDeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    type: 'title' | 'deed';
    id: string;
    name?: string;
    description?: string;
    owner?: string;
    purchased_at?: string;
    issue_date?: string;
    current_value?: number;
    car_id?: string;
    address?: string;
    rent_amount?: number;
    serial_id?: string;
    rarity?: string;
    metadata?: Record<string, any>;
    carDef?: {
      name: string;
      price: number;
      description?: string;
    };
  } | null;
}

export default function TitleDeedModal({ isOpen, onClose, item }: TitleDeedModalProps) {
  if (!isOpen || !item) return null;

  const isTitle = item.type === 'title';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className={`bg-zinc-900 border rounded-2xl w-full max-w-lg overflow-hidden relative ${
        isTitle ? 'border-emerald-500/30' : 'border-amber-500/30'
      }`}>
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Header */}
        <div className={`p-6 border-b ${isTitle ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-amber-900/20 border-amber-500/20'}`}>
          <div className="flex items-center gap-3 mb-2">
            {isTitle ? (
              <Car className="w-8 h-8 text-emerald-400" />
            ) : (
              <Home className="w-8 h-8 text-amber-400" />
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {isTitle ? 'Vehicle Title' : 'Property Deed'}
              </h2>
              <p className="text-xs text-zinc-400 uppercase tracking-wider">
                Official {isTitle ? 'Troll City' : 'Troll City'} Document
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Item Name */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="w-4 h-4 text-zinc-400" />
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Item Name</span>
            </div>
            <p className="text-lg font-bold text-white">
              {item.name || (isTitle ? item.carDef?.name : `Property #${item.id.slice(0, 8)}`)}
            </p>
          </div>

          {/* Description */}
          {item.description || item.carDef?.description && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Description</span>
              </div>
              <p className="text-sm text-gray-300">
                {item.description || item.carDef?.description}
              </p>
            </div>
          )}

          {/* Grid of details */}
          <div className="grid grid-cols-2 gap-4">
            {/* Owner */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Owner</span>
              </div>
              <p className="text-sm font-medium text-white">{item.owner || 'You'}</p>
            </div>

            {/* Issue/Purchase Date */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">
                  {isTitle ? 'Purchase Date' : 'Issue Date'}
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                {item.purchased_at || item.issue_date 
                  ? new Date(item.purchased_at || item.issue_date).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>

            {/* Value */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Current Value</span>
              </div>
              <p className="text-sm font-bold text-emerald-400">
                {(item.current_value || item.carDef?.price || 0).toLocaleString()} coins
              </p>
            </div>

            {/* Serial ID */}
            {item.serial_id && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Serial ID</span>
                </div>
                <p className="text-sm font-mono text-zinc-300">{item.serial_id}</p>
              </div>
            )}

            {/* Rarity */}
            {item.rarity && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">Rarity</span>
                </div>
                <p className={`text-sm font-bold ${
                  item.rarity === 'legendary' ? 'text-yellow-400' :
                  item.rarity === 'epic' ? 'text-purple-400' :
                  item.rarity === 'rare' ? 'text-blue-400' :
                  'text-gray-400'
                }`}>
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </p>
              </div>
            )}
          </div>

          {/* Property-specific details */}
          {!isTitle && item.address && (
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Home className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">Address</span>
              </div>
              <p className="text-sm text-white">{item.address}</p>
            </div>
          )}

          {/* Rent Income for properties */}
          {!isTitle && item.rent_amount !== undefined && (
            <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400 uppercase tracking-wider">Rent Income</span>
              </div>
              <p className="text-lg font-bold text-amber-400">
                {item.rent_amount.toLocaleString()} coins/week
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800">
          <p className="text-xs text-center text-zinc-500">
            Document ID: {item.id} • Issued by Troll City Authority
          </p>
        </div>
      </div>
    </div>
  );
}
