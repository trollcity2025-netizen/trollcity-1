import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Slider from '../components/ui/slider';
import { 
  Map as MapIcon, 
  Calendar as CalendarIcon, 
  Users as UsersIcon, 
  Plus as PlusIcon, 
  Briefcase as BriefcaseIcon, 
  Trophy as TrophyIcon, 
  Navigation as NavigationIcon, 
  CheckCircle2 as CheckCircleIcon, 
  XCircle as XCircleIcon,
  RefreshCw as RefreshCwIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Event categories
const eventCategories = [
  'Cleanup', 'Volunteer', 'Fitness', 'Social', 'Food', 'Education',
  'Animal Care', 'Safety', 'Other'
];

// Business categories
const businessCategories = [
  'Restaurant', 'Retail', 'Healthcare', 'Education', 'Entertainment',
  'Service', 'Other'
];

// Main Neighbors page component
const NeighborsPage = () => {
  const [activeTab, setActiveTab] = useState('nearby');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchRadius, setSearchRadius] = useState(40);
  const [events, setEvents] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Event creation form state
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    category: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    start_time: '',
    end_time: '',
    duration_minutes: 60,
    max_participants: 10,
    reward_coins: 100,
    requirements: '',
    images: [],
    visibility: 'public'
  });
  
  // Business registration form state
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [businessSuccess, setBusinessSuccess] = useState(false);
  const [myBusinesses, setMyBusinesses] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [hiringPosts, setHiringPosts] = useState<any[]>([]);
  const [creatingHiring, setCreatingHiring] = useState(false);
  const [hiringFormData, setHiringFormData] = useState({
    business_id: '',
    title: '',
    description: '',
    requirements: '',
    contact_email: '',
    contact_phone: '',
    location: '',
    job_type: 'full-time',
    pay_rate: ''
  });
  const [businessFormData, setBusinessFormData] = useState({
    business_name: '',
    description: '',
    category: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    logo_url: ''
  });

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUser(data.user);
      }
    };

    getUser();
  }, []);

  // Get user's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('Error getting user location:', error);
          // Default to center of USA if geolocation fails
          setUserLocation([39.8283, -98.5795]);
        }
      );
    } else {
      // Default to center of USA if geolocation not available
      setUserLocation([39.8283, -98.5795]);
    }
  }, []);

  // Fetch nearby events
  useEffect(() => {
    const fetchNearbyEvents = async () => {
      if (!userLocation) return;

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_nearby_neighbors_events', {
          lat: userLocation[0],
          lng: userLocation[1],
          radius: searchRadius
        });

        if (error) {
          console.error('Error fetching nearby events:', error);
        } else {
          setEvents(data || []);
        }
      } catch (error) {
        console.error('Error fetching nearby events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyEvents();
  }, [userLocation, searchRadius]);

  // Fetch nearby businesses
  useEffect(() => {
    const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Radius of the earth in km
      const dLat = deg2rad(lat2 - lat1);
      const dLon = deg2rad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance;
    };
  
    const deg2rad = (deg: number) => {
      return deg * (Math.PI / 180);
    };

    const fetchNearbyBusinesses = async () => {
      if (!userLocation) return;

      try {
        const { data, error } = await supabase
          .from('neighbors_businesses')
          .select('*')
          .eq('verified', true);

        if (error) {
          console.error('Error fetching nearby businesses:', error);
        } else {
          // Filter businesses by distance
          const nearbyBusinesses = data.filter(business => {
            const distance = getDistanceFromLatLonInKm(
              userLocation[0],
              userLocation[1],
              business.latitude,
              business.longitude
            );
            return distance <= searchRadius;
          });

          setBusinesses(nearbyBusinesses);
        }
      } catch (error) {
        console.error('Error fetching nearby businesses:', error);
      }
    };

    fetchNearbyBusinesses();
  }, [userLocation, searchRadius]);

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('neighbors_participants')
          .select('*');

        if (error) {
          console.error('Error fetching participants:', error);
        } else {
          setParticipants(data || []);
        }
      } catch (error) {
        console.error('Error fetching participants:', error);
      }
    };

    fetchParticipants();
  }, []);

  // Calculate distance between two coordinates
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  // Create new event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error: eventError } = await supabase
        .from('neighbors_events')
        .insert([
          {
            ...eventFormData,
            created_by_user_id: userData.user?.id,
            start_time: new Date(eventFormData.start_time).toISOString(),
            end_time: new Date(eventFormData.end_time).toISOString()
          }
        ])
        .select()
        .single();

      if (eventError) throw eventError;

      // Reset form and close modal
      setEventFormData({
        title: '',
        description: '',
        category: '',
        latitude: 0,
        longitude: 0,
        city: '',
        state: '',
        start_time: '',
        end_time: '',
        duration_minutes: 60,
        max_participants: 10,
        reward_coins: 100,
        requirements: '',
        images: [],
        visibility: 'public'
      });
      setCreatingEvent(false);

      // Refresh events list
      const { data: updatedEvents } = await supabase.rpc('get_nearby_neighbors_events', {
        lat: userLocation?.[0] || 0,
        lng: userLocation?.[1] || 0,
        radius: searchRadius
      });
      setEvents(updatedEvents || []);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // Register new business
  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error: businessError } = await supabase
        .from('neighbors_businesses')
        .insert([
          {
            ...businessFormData,
            owner_user_id: userData.user?.id,
            verified: false
          }
        ])
        .select()
        .single();

      if (businessError) throw businessError;

      // Reset form and close modal
      setBusinessFormData({
        business_name: '',
        description: '',
        category: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        latitude: 0,
        longitude: 0,
        city: '',
        state: '',
        logo_url: ''
      });
      setCreatingBusiness(false);
      setBusinessSuccess(true);

      // Refresh businesses list - show only approved
      const { data: allBusinesses } = await supabase
        .from('neighbors_businesses')
        .select('*')
        .eq('approval_status', 'approved');

      const nearbyBusinesses = allBusinesses.filter(business => {
        const distance = getDistanceFromLatLonInKm(
          userLocation?.[0] || 0,
          userLocation?.[1] || 0,
          business.latitude,
          business.longitude
        );
        return distance <= searchRadius;
      });

      setBusinesses(nearbyBusinesses);
    } catch (error) {
      console.error('Error registering business:', error);
    }
  };

  // Join event
  const handleJoinEvent = async (eventId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error } = await supabase
        .from('neighbors_participants')
        .insert([
          {
            event_id: eventId,
            user_id: userData.user?.id,
            status: 'joined'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error joining event:', error);
    }
  };

  // Get participant status for an event
  const getParticipantStatus = (eventId: string, userId: string) => {
    const participant = participants.find(p => 
      p.event_id === eventId && p.user_id === userId
    );
    return participant?.status;
  };

  // Get number of participants for an event
  const getParticipantCount = (eventId: string) => {
    return participants.filter(p => p.event_id === eventId).length;
  };

  // Render event marker on map
  const renderEventMarker = (event: any) => {
    const participantCount = getParticipantCount(event.id);
    
    return (
      <Marker position={[event.latitude, event.longitude]}>
        <Popup>
          <div className="p-3">
            <h3 className="font-bold text-lg mb-2">{event.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
            <div className="space-y-1 text-sm">
              <div>
                <Badge variant="secondary" className="mr-1">
                  {event.category}
                </Badge>
                {event.business_id && (
                  <Badge variant="outline" className="mr-1">
                    Business Event
                  </Badge>
                )}
              </div>
              <div>
                <UsersIcon className="w-4 h-4 inline mr-1" />
                {participantCount} participants
              </div>
              <div>
                <TrophyIcon className="w-4 h-4 inline mr-1" />
                {event.reward_coins} coins
              </div>
              <div>
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                {new Date(event.start_time).toLocaleString()}
              </div>
              <div>
                <NavigationIcon className="w-4 h-4 inline mr-1" />
                {event.city}, {event.state}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Button 
                className="w-full"
                onClick={() => handleJoinEvent(event.id)}
                disabled={getParticipantStatus(event.id, user?.id)}
              >
                Join Event
              </Button>
              <Button variant="outline" className="w-full">
                Get Directions
              </Button>
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  // Render business marker on map
  const renderBusinessMarker = (business: any) => {
    return (
      <Marker position={[business.latitude, business.longitude]}>
        <Popup>
          <div className="p-3">
            <h3 className="font-bold text-lg mb-2">{business.business_name}</h3>
            <p className="text-sm text-gray-600 mb-2">{business.description}</p>
            <div className="space-y-1 text-sm">
              <div>
                <Badge variant="secondary" className="mr-1">
                  {business.category}
                </Badge>
                {business.verified && (
                  <Badge variant="outline" className="mr-1">
                    Verified
                  </Badge>
                )}
              </div>
              <div>
                <BriefcaseIcon className="w-4 h-4 inline mr-1" />
                {business.address}
              </div>
              <div>
                <NavigationIcon className="w-4 h-4 inline mr-1" />
                {business.city}, {business.state}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Button variant="outline" className="w-full">
                View Profile
              </Button>
              <Button variant="outline" className="w-full">
                Get Directions
              </Button>
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white text-slate-900 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 animate-gradient-shift" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_90%_90%,rgba(236,72,153,0.12),transparent)]" />
      </div>
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
          .animate-gradient-shift {
            animation: gradient-shift 12s ease-in-out infinite;
          }
        `}
      </style>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/40 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.35)]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
        <style>
          {`
            @keyframes float-particle {
              0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
              10% { opacity: 0.6; }
              90% { opacity: 0.6; }
              50% { transform: translateY(-100px) translateX(50px); }
            }
          `}
        </style>
      </div>

      <div className="relative z-10">
      <div className="container mx-auto p-4">
        {/* Success Message */}
        {businessSuccess && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-500 rounded-lg flex justify-between items-center">
            <div className="text-green-200">
              <p className="font-semibold">Business registered successfully!</p>
              <p className="text-sm">Your business is pending verification and will appear once approved.</p>
            </div>
            <button 
              onClick={() => setBusinessSuccess(false)}
              className="text-green-400 hover:text-green-200"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white">Neighbors</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setCreatingEvent(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Event
            </Button>
            <Button 
              onClick={() => setCreatingBusiness(true)}
              variant="outline"
              className="border-purple-500 text-purple-400 hover:bg-purple-900/30"
            >
              <BriefcaseIcon className="w-4 h-4 mr-2" />
              Register Business
            </Button>
          </div>
        </div>

        <Tabs defaultValue="nearby" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-8 mb-6 bg-slate-800/50">
            <TabsTrigger value="nearby" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-300">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Nearby
            </TabsTrigger>
            <TabsTrigger value="map">
              <MapIcon className="w-4 h-4 mr-2" />
              Map
            </TabsTrigger>
            <TabsTrigger value="my-events">
              <UsersIcon className="w-4 h-4 mr-2" />
              My Events
            </TabsTrigger>
            <TabsTrigger value="create-event">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create
            </TabsTrigger>
            <TabsTrigger value="businesses">
              <BriefcaseIcon className="w-4 h-4 mr-2" />
              Biz
            </TabsTrigger>
            <TabsTrigger value="my-profile">
              <UsersIcon className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="hiring">
              <BriefcaseIcon className="w-4 h-4 mr-2" />
              Hiring
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <TrophyIcon className="w-4 h-4 mr-2" />
              Top
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nearby" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Nearby Events</h2>
                <div className="flex items-center space-x-2">
                  <Label className="text-sm text-gray-600">Radius:</Label>
                  <div className="flex items-center space-x-2 w-48">
                    <Slider
                      value={searchRadius}
                      onValueChange={setSearchRadius}
                      min={5}
                      max={100}
                      step={5}
                      className="w-32"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {searchRadius} km
                    </span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No events nearby</h3>
                  <p className="text-slate-400">Try increasing your search radius or check back later.</p>
                  <Button 
                    onClick={() => setCreatingEvent(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create an Event
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map(event => (
                    <Card key={event.id} className="overflow-hidden bg-slate-800/60 border-slate-700">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg text-white">{event.title}</h3>
                            <p className="text-sm text-slate-300">{event.description}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2 bg-purple-600">
                            {event.category}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-slate-300 mb-4">
                          <div className="flex items-center">
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {new Date(event.start_time).toLocaleString()}
                          </div>
                          <div>
                            <NavigationIcon className="w-4 h-4 mr-2" />
                            {event.city}, {event.state}
                          </div>
                          <div className="flex items-center">
                            <UsersIcon className="w-4 h-4 mr-2" />
                            {getParticipantCount(event.id)} participants
                          </div>
                          <div className="flex items-center">
                            <TrophyIcon className="w-4 h-4 mr-2" />
                            {event.reward_coins} coins
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button 
                            className="flex-1"
                            onClick={() => handleJoinEvent(event.id)}
                            disabled={getParticipantStatus(event.id, user?.id)}
                          >
                            Join Event
                          </Button>
                          <Button variant="outline" size="sm">
                            Details
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Map View</h2>
                <div className="flex items-center space-x-2">
                  <Label className="text-sm text-gray-600">Radius:</Label>
                  <div className="flex items-center space-x-2 w-48">
                    <Slider
                      value={searchRadius}
                      onValueChange={setSearchRadius}
                      min={5}
                      max={100}
                      step={5}
                      className="w-32"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {searchRadius} km
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[500px] rounded-lg overflow-hidden">
                {userLocation && (
                  <MapContainer
                    center={userLocation}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="© OpenStreetMap contributors"
                    />
                    
                    {/* User location marker */}
                    <Marker position={userLocation}>
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg mb-2">Your Location</h3>
                          <p className="text-sm text-gray-600">You are here</p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Event markers */}
                    {events.map(event => renderEventMarker(event))}

                    {/* Business markers */}
                    {businesses.map(business => renderBusinessMarker(business))}
                  </MapContainer>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-events" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">My Events</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* TODO: Implement my events list */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">No events yet</h3>
                    <Button 
                      onClick={() => setCreatingEvent(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Create Event
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="create-event" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">Create Event</h2>
              
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-title">Event Title</Label>
                    <Input
                      id="event-title"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({...eventFormData, title: e.target.value})}
                      placeholder="Enter event title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-category">Category</Label>
                    <Select
                      value={eventFormData.category}
                      onValueChange={(value) => setEventFormData({...eventFormData, category: value})}
                    >
                      <SelectTrigger id="event-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 text-white">
                        {eventCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({...eventFormData, description: e.target.value})}
                    placeholder="Enter event description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-city">City</Label>
                    <Input
                      id="event-city"
                      value={eventFormData.city}
                      onChange={(e) => setEventFormData({...eventFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-state">State</Label>
                    <Input
                      id="event-state"
                      value={eventFormData.state}
                      onChange={(e) => setEventFormData({...eventFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-start-time">Start Time</Label>
                    <Input
                      id="event-start-time"
                      type="datetime-local"
                      value={eventFormData.start_time}
                      onChange={(e) => setEventFormData({...eventFormData, start_time: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-end-time">End Time</Label>
                    <Input
                      id="event-end-time"
                      type="datetime-local"
                      value={eventFormData.end_time}
                      onChange={(e) => setEventFormData({...eventFormData, end_time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-max-participants">Max Participants</Label>
                    <Input
                      id="event-max-participants"
                      type="number"
                      value={eventFormData.max_participants}
                      onChange={(e) => setEventFormData({...eventFormData, max_participants: parseInt(e.target.value)})}
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-reward-coins">Reward Coins</Label>
                    <Input
                      id="event-reward-coins"
                      type="number"
                      value={eventFormData.reward_coins}
                      onChange={(e) => setEventFormData({...eventFormData, reward_coins: parseInt(e.target.value)})}
                      min="0"
                      max="10000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="event-requirements">Requirements (Optional)</Label>
                  <Textarea
                    id="event-requirements"
                    value={eventFormData.requirements}
                    onChange={(e) => setEventFormData({...eventFormData, requirements: e.target.value})}
                    placeholder="Enter any specific requirements or instructions"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="event-visibility">Visibility</Label>
                  <Select
                    value={eventFormData.visibility}
                    onValueChange={(value) => setEventFormData({...eventFormData, visibility: value})}
                  >
                    <SelectTrigger id="event-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="neighborhood">Neighborhood Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create Event
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setEventFormData({
                      title: '',
                      description: '',
                      category: '',
                      latitude: 0,
                      longitude: 0,
                      city: '',
                      state: '',
                      start_time: '',
                      end_time: '',
                      duration_minutes: 60,
                      max_participants: 10,
                      reward_coins: 100,
                      requirements: '',
                      images: [],
                      visibility: 'public'
                    })}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="businesses" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">Businesses</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {businesses.length === 0 ? (
                  <Card className="p-4 col-span-full">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">No businesses nearby</h3>
                      <Button 
                        onClick={() => setCreatingBusiness(true)}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        Register Business
                      </Button>
                    </div>
                  </Card>
                ) : (
                  businesses.map(business => (
                    <Card key={business.id} className="overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{business.business_name}</h3>
                            <p className="text-sm text-gray-600">{business.description}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {business.category}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          <div>
                            <NavigationIcon className="w-4 h-4 inline mr-1" />
                            {business.address}
                          </div>
                          <div>
                            <NavigationIcon className="w-4 h-4 inline mr-1" />
                            {business.city}, {business.state}
                          </div>
                          {business.phone && (
                            <div>
                              <UsersIcon className="w-4 h-4 inline mr-1" />
                              {business.phone}
                            </div>
                          )}
                          {business.email && (
                            <div>
                              <UsersIcon className="w-4 h-4 inline mr-1" />
                              {business.email}
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-2">
                          <Button variant="outline" className="flex-1">
                            View Profile
                          </Button>
                          <Button variant="outline" size="sm">
                            Get Directions
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* My Profile Tab - Shows user's businesses and events */}
          <TabsContent value="my-profile" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">My Profile</h2>
                <button
                  onClick={async () => {
                    setLoadingProfile(true);
                    try {
                      const { data: userData } = await supabase.auth.getUser();
                      if (userData?.user) {
                        // Fetch user's businesses
                        const { data: businesses } = await supabase
                          .from('neighbors_businesses')
                          .select('*')
                          .eq('owner_user_id', userData.user.id);
                        setMyBusinesses(businesses || []);
                        
                        // Fetch user's events
                        const { data: events } = await supabase
                          .from('neighbors_events')
                          .select('*')
                          .eq('created_by_user_id', userData.user.id);
                        setMyEvents(events || []);
                      }
                    } catch (err) {
                      console.error('Error loading profile:', err);
                    } finally {
                      setLoadingProfile(false);
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center"
                >
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                  Refresh
                </button>
              </div>

              {loadingProfile ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <>
                  {/* My Businesses */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-white mb-3">My Businesses</h3>
                    {myBusinesses.length === 0 ? (
                      <p className="text-slate-400">You haven&apos;t registered any businesses yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myBusinesses.map(business => (
                          <div key={business.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-white">{business.business_name}</h4>
                              {business.verified ? (
                                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full flex items-center">
                                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                                  Approved
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">
                                  Pending Review
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{business.description}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded">
                                {business.category}
                              </span>
                              {business.phone && (
                                <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded">
                                  📞 {business.phone}
                                </span>
                              )}
                              {business.email && (
                                <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded">
                                  📧 {business.email}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              📍 {business.address}, {business.city}, {business.state}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* My Events */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-3">My Events</h3>
                    {myEvents.length === 0 ? (
                      <p className="text-slate-400">You haven&apos;t created any events yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myEvents.map(event => (
                          <div key={event.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-white">{event.title}</h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                event.status === 'active' ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'
                              }`}>
                                {event.status || 'active'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{event.description}</p>
                            <div className="text-xs text-slate-400">
                              📅 {event.start_time ? new Date(event.start_time).toLocaleDateString() : 'TBD'}
                              {event.city && ` • 📍 ${event.city}, ${event.state}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Hiring Tab - Job postings from businesses */}
          <TabsContent value="hiring" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Hiring & Jobs</h2>
                {myBusinesses.filter(b => b.verified).length > 0 && (
                  <button
                    onClick={() => setCreatingHiring(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Post Job
                  </button>
                )}
              </div>

              {myBusinesses.filter(b => b.verified).length === 0 ? (
                <p className="text-slate-400">
                  You need a verified business to post jobs. Register a business first!
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hiringPosts.length === 0 ? (
                    <p className="text-slate-400 col-span-2">No job postings yet. Be the first to post!</p>
                  ) : (
                    hiringPosts.map(post => (
                      <div key={post.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-white">{post.title}</h4>
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                            {post.job_type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">{post.description}</p>
                        {post.requirements && (
                          <p className="text-xs text-slate-400 mb-2">Requirements: {post.requirements}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {post.contact_email && (
                            <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded">
                              📧 {post.contact_email}
                            </span>
                          )}
                          {post.contact_phone && (
                            <span className="px-2 py-1 bg-slate-600 text-slate-200 text-xs rounded">
                              📞 {post.contact_phone}
                            </span>
                          )}
                          {post.pay_rate && (
                            <span className="px-2 py-1 bg-green-600/50 text-green-200 text-xs rounded">
                              💰 {post.pay_rate}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Create Hiring Modal */}
            {creatingHiring && (
              <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
                <div className="bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-white">Post a Job</h2>
                      <button
                        onClick={() => setCreatingHiring(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <XCircleIcon className="w-6 h-6" />
                      </button>
                    </div>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const { data: userData } = await supabase.auth.getUser();
                        if (!userData?.user) return;

                        const { error } = await supabase
                          .from('neighbors_hiring')
                          .insert([{
                            ...hiringFormData,
                            owner_user_id: userData.user.id
                          }]);

                        if (error) throw error;

                        setCreatingHiring(false);
                        setHiringFormData({
                          business_id: '',
                          title: '',
                          description: '',
                          requirements: '',
                          contact_email: '',
                          contact_phone: '',
                          location: '',
                          job_type: 'full-time',
                          pay_rate: ''
                        });

                        // Refresh hiring posts
                        const { data: posts } = await supabase
                          .from('neighbors_hiring')
                          .select('*, neighbors_businesses(business_name)')
                          .eq('is_active', true);
                        setHiringPosts(posts || []);
                      } catch (err) {
                        console.error('Error posting job:', err);
                      }
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="hiring-business" className="text-white">Business</Label>
                        <Select
                          value={hiringFormData.business_id}
                          onValueChange={(value) => setHiringFormData({...hiringFormData, business_id: value})}
                        >
                          <SelectTrigger id="hiring-business" className="bg-slate-700 text-white">
                            <SelectValue placeholder="Select your business" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 text-white">
                            {myBusinesses.filter(b => b.verified).map(b => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.business_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="hiring-title" className="text-white">Job Title</Label>
                        <Input
                          id="hiring-title"
                          value={hiringFormData.title}
                          onChange={(e) => setHiringFormData({...hiringFormData, title: e.target.value})}
                          placeholder="e.g., Server, Manager, Cook"
                          required
                          className="bg-slate-700 text-white"
                        />
                      </div>

                      <div>
                        <Label htmlFor="hiring-description" className="text-white">Description</Label>
                        <Textarea
                          id="hiring-description"
                          value={hiringFormData.description}
                          onChange={(e) => setHiringFormData({...hiringFormData, description: e.target.value})}
                          placeholder="Describe the job responsibilities..."
                          className="bg-slate-700 text-white"
                        />
                      </div>

                      <div>
                        <Label htmlFor="hiring-requirements" className="text-white">Requirements</Label>
                        <Textarea
                          id="hiring-requirements"
                          value={hiringFormData.requirements}
                          onChange={(e) => setHiringFormData({...hiringFormData, requirements: e.target.value})}
                          placeholder="Required skills, experience..."
                          className="bg-slate-700 text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="hiring-type" className="text-white">Job Type</Label>
                          <Select
                            value={hiringFormData.job_type}
                            onValueChange={(value) => setHiringFormData({...hiringFormData, job_type: value})}
                          >
                            <SelectTrigger id="hiring-type" className="bg-slate-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 text-white">
                              <SelectItem value="full-time">Full-time</SelectItem>
                              <SelectItem value="part-time">Part-time</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="hiring-pay" className="text-white">Pay Rate</Label>
                          <Input
                            id="hiring-pay"
                            value={hiringFormData.pay_rate}
                            onChange={(e) => setHiringFormData({...hiringFormData, pay_rate: e.target.value})}
                            placeholder="e.g., $15-20/hr"
                            className="bg-slate-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="hiring-email" className="text-white">Contact Email</Label>
                          <Input
                            id="hiring-email"
                            type="email"
                            value={hiringFormData.contact_email}
                            onChange={(e) => setHiringFormData({...hiringFormData, contact_email: e.target.value})}
                            placeholder="contact@business.com"
                            className="bg-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="hiring-phone" className="text-white">Contact Phone</Label>
                          <Input
                            id="hiring-phone"
                            value={hiringFormData.contact_phone}
                            onChange={(e) => setHiringFormData({...hiringFormData, contact_phone: e.target.value})}
                            placeholder="(555) 123-4567"
                            className="bg-slate-700 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="hiring-location" className="text-white">Location</Label>
                        <Input
                          id="hiring-location"
                          value={hiringFormData.location}
                          onChange={(e) => setHiringFormData({...hiringFormData, location: e.target.value})}
                          placeholder="Address or area"
                          className="bg-slate-700 text-white"
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          type="button"
                          onClick={() => setCreatingHiring(false)}
                          variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Post Job
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur rounded-lg shadow p-4 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">Leaderboard (Coming Soon)</h2>
              
              <div className="text-center py-12">
                <TrophyIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Leaderboard Coming Soon</h3>
                <p className="text-slate-400">Check back later to see the top participants in your area.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/* Create Event Modal */}
      {creatingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create New Event</h2>
                <button
                  onClick={() => setCreatingEvent(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-title">Event Title</Label>
                    <Input
                      id="modal-event-title"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({...eventFormData, title: e.target.value})}
                      placeholder="Enter event title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-category">Category</Label>
                    <Select
                      value={eventFormData.category}
                      onValueChange={(value) => setEventFormData({...eventFormData, category: value})}
                    >
                      <SelectTrigger id="modal-event-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 text-white">
                        {eventCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="modal-event-description">Description</Label>
                  <Textarea
                    id="modal-event-description"
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({...eventFormData, description: e.target.value})}
                    placeholder="Enter event description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-city">City</Label>
                    <Input
                      id="modal-event-city"
                      value={eventFormData.city}
                      onChange={(e) => setEventFormData({...eventFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-state">State</Label>
                    <Input
                      id="modal-event-state"
                      value={eventFormData.state}
                      onChange={(e) => setEventFormData({...eventFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-start-time">Start Time</Label>
                    <Input
                      id="modal-event-start-time"
                      type="datetime-local"
                      value={eventFormData.start_time}
                      onChange={(e) => setEventFormData({...eventFormData, start_time: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-end-time">End Time</Label>
                    <Input
                      id="modal-event-end-time"
                      type="datetime-local"
                      value={eventFormData.end_time}
                      onChange={(e) => setEventFormData({...eventFormData, end_time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-max-participants">Max Participants</Label>
                    <Input
                      id="modal-event-max-participants"
                      type="number"
                      value={eventFormData.max_participants}
                      onChange={(e) => setEventFormData({...eventFormData, max_participants: parseInt(e.target.value)})}
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-reward-coins">Reward Coins</Label>
                    <Input
                      id="modal-event-reward-coins"
                      type="number"
                      value={eventFormData.reward_coins}
                      onChange={(e) => setEventFormData({...eventFormData, reward_coins: parseInt(e.target.value)})}
                      min="0"
                      max="10000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="modal-event-requirements">Requirements (Optional)</Label>
                  <Textarea
                    id="modal-event-requirements"
                    value={eventFormData.requirements}
                    onChange={(e) => setEventFormData({...eventFormData, requirements: e.target.value})}
                    placeholder="Enter any specific requirements or instructions"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="modal-event-visibility">Visibility</Label>
                  <Select
                    value={eventFormData.visibility}
                    onValueChange={(value) => setEventFormData({...eventFormData, visibility: value})}
                  >
                    <SelectTrigger id="modal-event-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="neighborhood">Neighborhood Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create Event
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEventFormData({
                        title: '',
                        description: '',
                        category: '',
                        latitude: 0,
                        longitude: 0,
                        city: '',
                        state: '',
                        start_time: '',
                        end_time: '',
                        duration_minutes: 60,
                        max_participants: 10,
                        reward_coins: 100,
                        requirements: '',
                        images: [],
                        visibility: 'public'
                      });
                      setCreatingEvent(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Register Business Modal */}
      {creatingBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-slate-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Register Business</h2>
                <button
                  onClick={() => setCreatingBusiness(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleRegisterBusiness} className="space-y-4">
                <div>
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={businessFormData.business_name}
                    onChange={(e) => setBusinessFormData({...businessFormData, business_name: e.target.value})}
                    placeholder="Enter business name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="business-category">Category</Label>
                  <Select
                    value={businessFormData.category}
                    onValueChange={(value) => setBusinessFormData({...businessFormData, category: value})}
                  >
                    <SelectTrigger id="business-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 text-white">
                      {businessCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="business-description">Description</Label>
                  <Textarea
                    id="business-description"
                    value={businessFormData.description}
                    onChange={(e) => setBusinessFormData({...businessFormData, description: e.target.value})}
                    placeholder="Enter business description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-phone">Phone</Label>
                    <Input
                      id="business-phone"
                      value={businessFormData.phone}
                      onChange={(e) => setBusinessFormData({...businessFormData, phone: e.target.value})}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-email">Email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={businessFormData.email}
                      onChange={(e) => setBusinessFormData({...businessFormData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="business-website">Website</Label>
                  <Input
                    id="business-website"
                    type="url"
                    value={businessFormData.website}
                    onChange={(e) => setBusinessFormData({...businessFormData, website: e.target.value})}
                    placeholder="Enter website URL"
                  />
                </div>

                <div>
                  <Label htmlFor="business-address">Address</Label>
                  <Input
                    id="business-address"
                    value={businessFormData.address}
                    onChange={(e) => setBusinessFormData({...businessFormData, address: e.target.value})}
                    placeholder="Enter full address"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-city">City</Label>
                    <Input
                      id="business-city"
                      value={businessFormData.city}
                      onChange={(e) => setBusinessFormData({...businessFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-state">State</Label>
                    <Input
                      id="business-state"
                      value={businessFormData.state}
                      onChange={(e) => setBusinessFormData({...businessFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="business-logo">Logo URL</Label>
                  <Input
                    id="business-logo"
                    type="url"
                    value={businessFormData.logo_url}
                    onChange={(e) => setBusinessFormData({...businessFormData, logo_url: e.target.value})}
                    placeholder="Enter logo URL"
                  />
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Register Business
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBusinessFormData({
                        business_name: '',
                        description: '',
                        category: '',
                        phone: '',
                        email: '',
                        website: '',
                        address: '',
                        latitude: 0,
                        longitude: 0,
                        city: '',
                        state: '',
                        logo_url: ''
                      });
                      setCreatingBusiness(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeighborsPage;
