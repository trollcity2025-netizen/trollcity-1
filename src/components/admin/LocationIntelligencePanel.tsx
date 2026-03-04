/**
 * Troll City Admin Dashboard - Location Intelligence Panel
 * 
 * This component displays user location data for emergency response.
 * ONLY accessible to super_admin and platform_admin roles.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { LocationIntelligenceItem, EmergencyUserInfo } from '@/types/safety';
import { geolocationService, formatLocation, formatCoordinates } from '@/services/geolocationService';
import { 
  MapPin, 
  Search, 
  User, 
  Globe, 
  Wifi, 
  AlertTriangle,
  RefreshCw,
  Download,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface LocationIntelligencePanelProps {
  adminId: string;
  adminRole: string;
}

interface EmergencyInfoModalProps {
  userInfo: EmergencyUserInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================
// EMERGENCY INFO MODAL
// ============================================================

const EmergencyInfoModal: React.FC<EmergencyInfoModalProps> = ({ 
  userInfo, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen || !userInfo) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-red-950 border-2 border-red-600 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <div>
            <h3 className="text-xl font-bold text-white">EMERGENCY USER INFO</h3>
            <p className="text-red-400 text-sm">For law enforcement use only</p>
          </div>
        </div>
        
        <div className="space-y-3 mb-6">
          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">Username</p>
            <p className="text-lg text-white font-mono">@{userInfo.username}</p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">User ID</p>
            <p className="text-sm text-white font-mono">{userInfo.user_id}</p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">Email</p>
            <p className="text-sm text-white font-mono">{userInfo.email || 'N/A'}</p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">IP Address</p>
            <p className="text-sm text-white font-mono">{userInfo.latest_ip || 'N/A'}</p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">Approximate Location</p>
            <p className="text-lg text-white">
              {formatLocation(userInfo.city, userInfo.state, userInfo.country)}
            </p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">ISP / Provider</p>
            <p className="text-sm text-white">{userInfo.isp || 'Unknown'}</p>
          </div>

          <div className="p-3 bg-red-900/50 rounded">
            <p className="text-xs text-red-400 uppercase">Last Seen</p>
            <p className="text-sm text-white">
              {userInfo.last_seen ? new Date(userInfo.last_seen).toLocaleString() : 'Unknown'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              // Copy to clipboard
              const info = `Username: @${userInfo.username}
User ID: ${userInfo.user_id}
Email: ${userInfo.email || 'N/A'}
IP: ${userInfo.latest_ip || 'N/A'}
Location: ${formatLocation(userInfo.city, userInfo.state, userInfo.country)}
ISP: ${userInfo.isp || 'Unknown'}
Last Seen: ${userInfo.last_seen ? new Date(userInfo.last_seen).toLocaleString() : 'Unknown'}`;
              navigator.clipboard.writeText(info);
            }}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const LocationIntelligencePanel: React.FC<LocationIntelligencePanelProps> = ({
  adminId: _adminId,
  adminRole
}) => {
  const [locations, setLocations] = useState<LocationIntelligenceItem[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationIntelligenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [_selectedLocation, _setSelectedLocation] = useState<LocationIntelligenceItem | null>(null);
  const [emergencyInfo, setEmergencyInfo] = useState<EmergencyUserInfo | null>(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [showRestricted, setShowRestricted] = useState(false);

  // Check if user has access
  const hasAccess = adminRole === 'super_admin' || adminRole === 'platform_admin';

  // Fetch location data
  const fetchLocations = useCallback(async () => {
    if (!hasAccess) return;

    try {
      setIsLoading(true);
      const data = await geolocationService.getLocationIntelligence();
      setLocations(data);
      setFilteredLocations(data);
    } catch (error) {
      console.error('Failed to fetch location data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Filter locations
  useEffect(() => {
    if (!searchQuery) {
      setFilteredLocations(locations);
      return;
    }

    const filtered = locations.filter(loc => 
      loc.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.ip_address?.includes(searchQuery) ||
      loc.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.country?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLocations(filtered);
  }, [searchQuery, locations]);

  // Handle emergency info request
  const handleEmergencyInfo = async (userId: string) => {
    try {
      const info = await geolocationService.getEmergencyUserInfo(userId);
      if (info) {
        setEmergencyInfo(info);
        setIsEmergencyModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to get emergency info:', error);
    }
  };

  // Export data
  const handleExport = () => {
    const csvContent = [
      ['Username', 'IP Address', 'City', 'State', 'Country', 'ISP', 'Last Seen'].join(','),
      ...filteredLocations.map(loc => [
        loc.username,
        loc.ip_address,
        loc.city || '',
        loc.state || '',
        loc.country || '',
        loc.isp || '',
        loc.last_seen
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `location-intelligence-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!hasAccess) {
    return (
      <div className="bg-gray-900 rounded-lg p-12 text-center">
        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-gray-400">
          Location intelligence is restricted to Super Admins and Platform Admins only.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-white">Location Intelligence</h2>
            <p className="text-gray-400 text-sm">User geolocation data for emergency response</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRestricted(!showRestricted)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
          >
            {showRestricted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showRestricted ? 'Hide IPs' : 'Show IPs'}
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <button
            onClick={fetchLocations}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username, IP, city, or country..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 text-white rounded"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-2xl font-bold text-white">{locations.length}</p>
          <p className="text-gray-400 text-sm">Total Records</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-2xl font-bold text-blue-400">
            {new Set(locations.map(l => l.country).filter(Boolean)).size}
          </p>
          <p className="text-gray-400 text-sm">Countries</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-2xl font-bold text-green-400">
            {filteredLocations.length}
          </p>
          <p className="text-gray-400 text-sm">Filtered Results</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-2xl font-bold text-yellow-400">
            {locations.filter(l => l.last_seen && new Date(l.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
          </p>
          <p className="text-gray-400 text-sm">Active (24h)</p>
        </div>
      </div>

      {/* Data Table */}
      {filteredLocations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No location data found</p>
          <p className="text-sm">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">IP Address</th>
                <th className="pb-3 font-medium">Location</th>
                <th className="pb-3 font-medium">Coordinates</th>
                <th className="pb-3 font-medium">ISP</th>
                <th className="pb-3 font-medium">Last Seen</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((loc) => (
                <tr 
                  key={loc.user_id} 
                  className="border-b border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-white">@{loc.username}</span>
                      <span className="text-gray-500 text-xs">({loc.role})</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300 font-mono text-sm">
                        {showRestricted ? loc.ip_address : '***.***.*.*'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-white text-sm">
                        {formatLocation(loc.city, loc.state, loc.country)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-gray-400 text-sm font-mono">
                      {formatCoordinates(loc.latitude, loc.longitude)}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-gray-400 text-sm">{loc.isp || 'Unknown'}</span>
                  </td>
                  <td className="py-3 text-gray-400 text-sm">
                    {loc.last_seen ? new Date(loc.last_seen).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => handleEmergencyInfo(loc.user_id)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Emergency Info
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Emergency Info Modal */}
      <EmergencyInfoModal
        userInfo={emergencyInfo}
        isOpen={isEmergencyModalOpen}
        onClose={() => {
          setIsEmergencyModalOpen(false);
          setEmergencyInfo(null);
        }}
      />
    </div>
  );
};

export default LocationIntelligencePanel;
