import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, Shield, CheckCircle, XCircle } from 'lucide-react';

export function LocationConsentModal({ isOpen, onClose, onConsent, userId }) {
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkLocationPermission();
    }
  }, [isOpen]);

  const checkLocationPermission = async () => {
    if (!navigator.permissions) {
      // Fallback for browsers without permissions API
      setLocationPermission('unknown');
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setLocationPermission(permission.state);
      
      permission.addEventListener('change', (e) => {
        setLocationPermission(e.target.state);
      });
    } catch (error) {
      console.error('Error checking location permission:', error);
      setLocationPermission('unknown');
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        setCurrentLocation(location);
        setLoading(false);
        toast.success('Location retrieved successfully');
      },
      (error) => {
        setLoading(false);
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        toast.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const handleConsent = async (hasConsented) => {
    try {
      setConsentGiven(true);
      
      // Save consent to database
      const { error } = await supabase
        .from('user_location_consent')
        .upsert({
          user_id: userId,
          has_consented: hasConsented,
          consent_given_at: hasConsented ? new Date().toISOString() : null,
          consent_version: 1
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      if (hasConsented && currentLocation) {
        // Store location data for emergency use
        await supabase
          .from('user_location_consent')
          .update({
            location_latitude: currentLocation.latitude,
            location_longitude: currentLocation.longitude,
            location_accuracy: currentLocation.accuracy
          })
          .eq('user_id', userId);
      }

      toast.success(hasConsented ? 'Location consent granted' : 'Location consent denied');
      onConsent(hasConsented, currentLocation);
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Error saving location consent:', error);
      toast.error('Failed to save location consent');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#0f0f15] border-[#2a2a3a] max-w-md w-full">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Safety Features</h2>
            <p className="text-gray-400 text-sm">
              Help us keep our community safe by sharing your location for emergency situations
            </p>
          </div>

          {/* Permission Status */}
          <div className="bg-[#1a1a25] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">Location Permission</span>
              <Badge 
                className={
                  locationPermission === 'granted' ? 'bg-green-600 text-white' :
                  locationPermission === 'denied' ? 'bg-red-600 text-white' :
                  'bg-yellow-600 text-black'
                }
              >
                {locationPermission === 'granted' ? 'Granted' :
                 locationPermission === 'denied' ? 'Denied' :
                 'Not Set'}
              </Badge>
            </div>
            <p className="text-gray-400 text-sm">
              {locationPermission === 'granted' ? 'You have already granted location access.' :
               locationPermission === 'denied' ? 'Location access is blocked. You can still use the platform but emergency features will be limited.' :
               'Your location will only be used for emergency safety situations.'}
            </p>
          </div>

          {/* Current Location */}
          {currentLocation && (
            <div className="bg-[#1a1a25] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium">Current Location</span>
              </div>
              <div className="text-gray-300 text-sm space-y-1">
                <p>Latitude: {currentLocation.latitude.toFixed(6)}</p>
                <p>Longitude: {currentLocation.longitude.toFixed(6)}</p>
                <p>Accuracy: ±{currentLocation.accuracy.toFixed(0)} meters</p>
              </div>
            </div>
          )}

          {/* Get Location Button */}
          {locationPermission !== 'denied' && (
            <Button
              onClick={getCurrentLocation}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {loading ? 'Getting Location...' : 'Get My Location'}
            </Button>
          )}

          {/* Consent Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleConsent(true)}
              disabled={consentGiven}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Allow
            </Button>
            <Button
              onClick={() => handleConsent(false)}
              disabled={consentGiven}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Deny
            </Button>
          </div>

          {/* Privacy Notice */}
          <p className="text-gray-500 text-xs text-center">
            Your location will only be accessed in emergency situations for safety purposes. 
            You can change this setting at any time in your account settings.
          </p>
        </div>
      </Card>
    </div>
  );
}

// Hook to check if user has location consent
export function useLocationConsent(userId) {
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkConsent = async () => {
      try {
        const { data, error } = await supabase
          .from('user_location_consent')
          .select('has_consented')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') { // Not found is OK
          console.error('Error checking location consent:', error);
        }

        setHasConsent(data?.has_consented || false);
      } catch (error) {
        console.error('Error checking location consent:', error);
      } finally {
        setLoading(false);
      }
    };

    checkConsent();
  }, [userId]);

  return { hasConsent, loading };
}