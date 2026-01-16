import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, Color3, ArcRotateCamera, Mesh, Texture, ParticleSystem, Color4, PointLight, PBRMaterial, CubeTexture, DirectionalLight, CascadedShadowGenerator, DefaultRenderingPipeline, ImageProcessingConfiguration, DynamicTexture, Animation, SceneLoader, GamepadManager, Xbox360Pad, GenericPad, Sound, Scalar, ColorCurves, BaseTexture, TransformNode } from '@babylonjs/core'
import '@babylonjs/loaders'
import { SkyMaterial } from '@babylonjs/materials'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Lights/hemisphericLight'
import '@babylonjs/core/Culling/ray'
import '@babylonjs/core/Meshes/meshBuilder'
// Import SSAO2 for advanced ambient occlusion
import { SSAO2RenderingPipeline } from '@babylonjs/core'
import { io, Socket } from 'socket.io-client'
import SimplePeer from 'simple-peer'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useXPStore } from '../stores/useXPStore'
import { useCoins } from '../lib/hooks/useCoins'
import { TrollCitySpinner } from '../components/TrollCitySpinner'
import { toast } from 'sonner'
import { cars } from '../data/vehicles'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'

interface InputState {
  forward: number
  steer: number
  brake: boolean
  boost: boolean
  interact: boolean
  cancel: boolean
}

interface Settings {
  masterVolume: number
  voiceVolume: number
  micSensitivity: number
  graphicsQuality: 'low' | 'medium' | 'high'
  gamepadDeadzone: number
  invertY: boolean
  voiceEnabled: boolean
  pushToTalk: boolean
}

interface VoicePeer {
  peerId: string
  peer: SimplePeer.Instance
  audio: HTMLAudioElement
}

const VOICE_SERVER_URL = (import.meta.env.VITE_VOICE_SERVER_URL ?? '').trim()
const IS_VOICE_CONFIGURED = VOICE_SERVER_URL.length > 0

interface TownHouse {
  id: string
  owner_user_id: string
  parcel_id: string
  position_x: number
  position_z: number
  metadata: any
  parcel_center_x: number
  parcel_center_z: number
  parcel_size_x: number
  parcel_size_z: number
  parcel_building_style?: string | null
  owner_username: string | null
  is_own: boolean
  last_raid_at: string | null
  last_raid_outcome: string | null
}

interface PlayerStateRow {
  user_id: string
  position_x: number
  position_z: number
  rotation_y: number
  vehicle: string | null
}

interface TownLocation {
  id: string
  name: string
  route: string
  position_x: number
  position_z: number
  type: 'store' | 'service' | 'church' | 'residential' | 'gas'
  metadata?: any
}

const TOWN_LOCATIONS: TownLocation[] = [
  // NORTH ZONE (Z > 150)
  {
    id: 'trollmart',
    name: 'TrollMart Superstore',
    route: '/trollmart',
    position_x: 120,
    position_z: 200,
    type: 'store',
    metadata: { color: '#0055aa', label: 'TrollMart' }
  },
  {
    id: 'trollgers',
    name: 'Trollgers Grocery',
    route: '/trollgers',
    position_x: -120,
    position_z: 200,
    type: 'store',
    metadata: { color: '#cc0000', label: 'Trollgers' }
  },
  
  // NORTHEAST ZONE
  {
    id: 'coin_store',
    name: 'Coin Store',
    route: '/store',
    position_x: 160,
    position_z: 120,
    type: 'store'
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    route: '/marketplace',
    position_x: 160,
    position_z: 60,
    type: 'store'
  },
  
  // NORTHWEST ZONE
  {
    id: 'sell_store',
    name: 'Sell on Troll City',
    route: '/sell',
    position_x: -160,
    position_z: 120,
    type: 'store',
    metadata: { color: '#ffaa00', label: 'Sell' }
  },
  {
    id: 'church',
    name: 'First Church of Troll',
    route: '/church',
    position_x: -160,
    position_z: 60,
    type: 'church'
  },
  
  // CENTRAL SOUTH ZONE (Z < -100)
  {
    id: 'gas_north',
    name: 'Gas Station North',
    route: '/gas',
    position_x: 80,
    position_z: -150,
    type: 'gas'
  },
  {
    id: 'dealership',
    name: 'Car Dealership',
    route: '/dealership',
    position_x: 120,
    position_z: -120,
    type: 'service'
  },
  {
    id: 'mechanic',
    name: 'Mechanic Shop',
    route: '/mechanic',
    position_x: 160,
    position_z: -150,
    type: 'service'
  },
  {
    id: 'gas_south',
    name: 'Gas Station South',
    route: '/gas',
    position_x: -80,
    position_z: -150,
    type: 'gas'
  },
  {
    id: 'auctions',
    name: 'Vehicle Auctions',
    route: '/auctions',
    position_x: -120,
    position_z: -120,
    type: 'service'
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard Hall',
    route: '/leaderboard',
    position_x: -160,
    position_z: -150,
    type: 'service'
  }
]

const TrollsTown3DPage: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  
  // Admin-only access check
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-[#1A1A1A] border-2 border-yellow-500/30 rounded-xl p-8">
            <div className="w-16 h-16 bg-yellow-500/20 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🚧</span>
            </div>
            <h1 className="text-3xl font-bold mb-4 text-yellow-400">Under Construction</h1>
            <p className="text-gray-300 text-lg mb-6">
              Trolls Town is currently being renovated and enhanced with new features!
            </p>
            <p className="text-gray-400 text-sm mb-8">
              We're working hard to bring you an improved experience. Check back soon!
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // -- New State for Settings & Voice --
  const [settings, setSettings] = useState<Settings>({
      masterVolume: 100,
      voiceVolume: 100,
      micSensitivity: 50,
      graphicsQuality: 'high',
      gamepadDeadzone: 0.15,
      invertY: false,
      voiceEnabled: IS_VOICE_CONFIGURED,
      pushToTalk: true
  })
  const [showSettings, setShowSettings] = useState(false)
  const [voicePeers, setVoicePeers] = useState<VoicePeer[]>([])
  const [micActive, setMicActive] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const userAudioStream = useRef<MediaStream | null>(null)
  const peersRef = useRef<{ [key: string]: SimplePeer.Instance }>({})
  const gamepadManagerRef = useRef<GamepadManager | null>(null)

  const carMeshRef = useRef<any>(null)
  const avatarMeshRef = useRef<any>(null)
  const createCharacterRef = useRef<any>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastStateSyncRef = useRef<number>(0)
  const housesRef = useRef<TownHouse[]>([])
  const ghostMeshesRef = useRef<Map<string, Mesh>>(new Map())
  const lastInteractRef = useRef(false)
  const raidTimerRef = useRef<number | null>(null)
  const lastChunkCenterRef = useRef<{ x: number; z: number } | null>(null)
  const isInCarRef = useRef(true)
  const activeVehicleRef = useRef<string | null>('playerCar')
  const isTransitioningRef = useRef(false)
  const fuelRef = useRef(100)
  const foodRef = useRef(100)
  const lastReportedFuelRef = useRef(100)
  const isChurchOpenRef = useRef(false)
  const activeRaidRef = useRef<any>(null) // Sync with state for loop access
  const showHousePanelRef = useRef(false)
  const isRefuelingRef = useRef(false)

  const [_houses, setHouses] = useState<TownHouse[]>([])
  const [speedKmh, setSpeedKmh] = useState(0)
  const [headingDeg, setHeadingDeg] = useState(0)
  const [isInCar, setIsInCar] = useState(true)
  const [nearHouse, setNearHouse] = useState<TownHouse | null>(null)
  const [nearLocation, setNearLocation] = useState<TownLocation | null>(null)
  const [showHousePanel, setShowHousePanel] = useState(false)
  const [activeRaid, setActiveRaid] = useState<{
    raidId: string
    houseId: string
    outcome?: 'success' | 'failure'
    loot?: number
  } | null>(null)
  const [raidTimeRemaining, setRaidTimeRemaining] = useState<number | null>(null)
  const [loadingHouses, setLoadingHouses] = useState(true)
  const [loadingMultiplayer, setLoadingMultiplayer] = useState(false)
  // const [coinBalance, setCoinBalance] = useState<number>(0) // Removed duplicate
  const [fuel, setFuel] = useState<number>(100) // 0-100
  const [food, setFood] = useState<number>(100) // 0-100
  const [isSunday, setIsSunday] = useState(false)
  const [_isChurchOpen, setIsChurchOpen] = useState(false)
  const [isRefueling, setIsRefueling] = useState(false)

  const [clothingColor, setClothingColor] = useState(new Color3(0.1, 0.2, 0.3))
  const [_parkedCars, setParkedCars] = useState<{ id: string, type: 'sedan'|'suv'|'truck', color: Color3, position: Vector3, rotation: number }[]>([])
  const parkedCarMeshesRef = useRef<Map<string, { root: Mesh, doorL: Mesh, doorR: Mesh }>>(new Map())
  const inputRef = useRef<InputState>({
    forward: 0,
    steer: 0,
    brake: false,
    boost: false,
    interact: false,
    cancel: false
  })

  useEffect(() => {
    // Generate parked cars on mount for expanded map
    const cars: { id: string, type: 'sedan'|'suv'|'truck', color: Color3, position: Vector3, rotation: number }[] = [];
    const colors = [
        new Color3(0.1, 0.1, 0.1), new Color3(0.8, 0.8, 0.8), new Color3(0.6, 0.1, 0.1),
        new Color3(0.1, 0.2, 0.6), new Color3(0.1, 0.5, 0.2), new Color3(0.7, 0.7, 0.1)
    ];
    const types: ('sedan'|'suv'|'truck')[] = ['sedan', 'suv', 'truck'];

    // Park along Main Road (Z axis) - expanded
    for(let z = -280; z <= 280; z += 30) {
        if (Math.abs(z) < 30) continue; // Skip intersection
        if (Math.random() > 0.6) {
            cars.push({
                id: `parked_${cars.length}`,
                type: types[Math.floor(Math.random() * types.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                position: new Vector3(10, 0, z), // Right side
                rotation: 0
            });
        }
        if (Math.random() > 0.6) {
            cars.push({
                id: `parked_${cars.length}`,
                type: types[Math.floor(Math.random() * types.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                position: new Vector3(-10, 0, z), // Left side
                rotation: Math.PI
            });
        }
    }
    setParkedCars(cars);
  }, []);

  const { user } = useAuthStore()
  const { fetchXP, subscribeToXP, unsubscribe } = useXPStore()
  const { balances } = useCoins()

  useEffect(() => {
    if (user?.id) {
        fetchXP(user.id)
        subscribeToXP(user.id)
        return () => unsubscribe()
    }
  }, [user?.id, fetchXP, subscribeToXP, unsubscribe])

  const coinBalance = balances.troll_coins || 0
  const [garagePrice, setGaragePrice] = useState(500)
  const [userGarages, setUserGarages] = useState<string[]>([])
  const [showGarageShop, setShowGarageShop] = useState(false)
  const [showWardrobe, setShowWardrobe] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)

  // Character State
  const [characterAppearance, setCharacterAppearance] = useState({
     skinColor: new Color3(0.8, 0.6, 0.5),
     topColor: new Color3(0.2, 0.2, 0.8),
     bottomColor: new Color3(0.1, 0.1, 0.1),
     hairStyle: 'short',
     topStyle: 'tshirt'
  })

  // Load State from LocalStorage
  useEffect(() => {
    if (user?.id) {
        const stored = localStorage.getItem(`trollcity_save_${user.id}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data.coinBalance) setCoinBalance(data.coinBalance);
                if (data.garages) setUserGarages(data.garages);
                if (data.character) setCharacterAppearance({
                    skinColor: new Color3(data.character.skin[0], data.character.skin[1], data.character.skin[2]),
                    topColor: new Color3(data.character.top[0], data.character.top[1], data.character.top[2]),
                    bottomColor: new Color3(data.character.bottom[0], data.character.bottom[1], data.character.bottom[2]),
                    hairStyle: data.character.hair || 'short',
                    topStyle: data.character.topStyle || 'tshirt'
                });
                setFirstLoad(false);
            } catch {}
        } else {
            // First time
            setFirstLoad(true);
            setShowWardrobe(true);
        }
    }
  }, [user?.id]);

  const saveGame = () => {
    if (!user?.id) return;
    const data = {
        coinBalance,
        garages: userGarages,
        character: {
            skin: [characterAppearance.skinColor.r, characterAppearance.skinColor.g, characterAppearance.skinColor.b],
            top: [characterAppearance.topColor.r, characterAppearance.topColor.g, characterAppearance.topColor.b],
            bottom: [characterAppearance.bottomColor.r, characterAppearance.bottomColor.g, characterAppearance.bottomColor.b],
            hair: characterAppearance.hairStyle,
            topStyle: characterAppearance.topStyle
        }
    };
    localStorage.setItem(`trollcity_save_${user.id}`, JSON.stringify(data));
  };
  
  // Auto-save
  useEffect(() => {
      if (!firstLoad) saveGame();
  }, [coinBalance, userGarages, characterAppearance]);

  // -- Gamepad Manager --
  useEffect(() => {
      // Gamepad support (Native Babylon.js)
      const gm = new GamepadManager();
      gamepadManagerRef.current = gm;
      
      gm.onGamepadConnectedObservable.add((gamepad, state) => {
          console.log("Gamepad connected:", gamepad.id);
          toast.success("Gamepad Connected: " + gamepad.id);
      });
      
      gm.onGamepadDisconnectedObservable.add((gamepad, state) => {
          console.log("Gamepad disconnected:", gamepad.id);
          toast.error("Gamepad Disconnected");
      });
      
      return () => {
          gm.dispose();
      };
  }, []);

  // -- Voice Chat (Socket.io + SimplePeer) --
  useEffect(() => {
      if (!user?.id || !settings.voiceEnabled || !IS_VOICE_CONFIGURED) return

      let cancelled = false
      let socket: Socket | null = null

      const startVoice = async () => {
          let stream: MediaStream

          try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          } catch (err) {
              console.error('Mic access denied', err)
              return
          }

          if (cancelled) {
              stream.getTracks().forEach(track => track.stop())
              return
          }

          userAudioStream.current = stream
          setMicActive(true)

          const controller = new AbortController()
          const timeoutId = window.setTimeout(() => controller.abort(), 1500)

          try {
              await fetch(VOICE_SERVER_URL, { mode: 'no-cors', signal: controller.signal })
          } catch {
              stream.getTracks().forEach(track => track.stop())
              userAudioStream.current = null
              setMicActive(false)
              return
          } finally {
              window.clearTimeout(timeoutId)
          }

          if (cancelled) {
              stream.getTracks().forEach(track => track.stop())
              userAudioStream.current = null
              setMicActive(false)
              return
          }

          socket = io(VOICE_SERVER_URL, {
              transports: ['websocket'],
              timeout: 3000,
              reconnectionAttempts: 2,
          })
          socketRef.current = socket

          socket.on('connect', () => {
              console.log('Connected to voice server')
              socket?.emit('join-room', 'trolltown-main', user.id)
          })

          socket.on('connect_error', () => {
              socket?.disconnect()
              socketRef.current = null
              stream.getTracks().forEach(track => track.stop())
              userAudioStream.current = null
              setMicActive(false)
          })

          socket.on('existing-users', (users: string[]) => {
              users.forEach(userId => {
                  const peer = createPeer(userId, socket!.id!, stream)
                  peersRef.current[userId] = peer
              })
          })

          socket.on('user-connected', (userId: string) => {
              const peer = addPeer(userId, socket!.id!, stream)
              peersRef.current[userId] = peer
          })

          socket.on('signal', (data: any) => {
              const peer = peersRef.current[data.from]
              if (peer) {
                  peer.signal(data.signal)
              }
          })

          socket.on('user-disconnected', (userId: string) => {
              if (peersRef.current[userId]) {
                  peersRef.current[userId].destroy()
                  delete peersRef.current[userId]
                  setVoicePeers(prev => prev.filter(p => p.peerId !== userId))
              }
          })
      }

      void startVoice()

      return () => {
          cancelled = true
          socket?.disconnect()
          socketRef.current = null
          Object.values(peersRef.current).forEach(peer => peer.destroy())
          peersRef.current = {}
          setVoicePeers([])
          if (userAudioStream.current) {
              userAudioStream.current.getTracks().forEach(track => track.stop())
              userAudioStream.current = null
          }
          setMicActive(false)
      }
  }, [user?.id, settings.voiceEnabled])

  const createPeer = (userToSignal: string, callerID: string, stream: MediaStream) => {
      const peer = new SimplePeer({
          initiator: true,
          trickle: false,
          stream,
      });

      peer.on("signal", (signal: any) => {
          socketRef.current?.emit("signal", { to: userToSignal, signal });
      });
      
      peer.on("stream", (stream: MediaStream) => {
          addAudioPeer(userToSignal, stream, peer);
      });

      return peer;
  };

  const addPeer = (incomingSignalID: string, callerID: string, stream: MediaStream) => {
      const peer = new SimplePeer({
          initiator: false,
          trickle: false,
          stream,
      });

      peer.on("signal", (signal: any) => {
          socketRef.current?.emit("signal", { to: incomingSignalID, signal });
      });

      peer.on("stream", (stream: MediaStream) => {
          addAudioPeer(incomingSignalID, stream, peer);
      });

      return peer;
  };
  
  const addAudioPeer = (id: string, stream: MediaStream, peer: SimplePeer.Instance) => {
      const audio = document.createElement('audio');
      audio.srcObject = stream;
      audio.autoplay = true;
      // Spatial audio would attach this to a Babylon Sound
      setVoicePeers(prev => [...prev, { peerId: id, peer, audio }]);
  };

  // Handle Garage Purchase
  const buyGarage = (garageId: string) => {
      if (coinBalance >= garagePrice && !userGarages.includes(garageId)) {
          setCoinBalance(prev => prev - garagePrice);
          setUserGarages(prev => [...prev, garageId]);
          toast.success(`Garage purchased for ${garagePrice} TC!`);
      } else if (userGarages.includes(garageId)) {
          toast.error("You already own this garage!");
      } else {
          toast.error("Not enough Troll Coins!");
      }
  };

  // Sync state to refs
  useEffect(() => { activeRaidRef.current = activeRaid }, [activeRaid])
  useEffect(() => { showHousePanelRef.current = showHousePanel }, [showHousePanel])
  useEffect(() => { isRefuelingRef.current = isRefueling }, [isRefueling])

  // Time & Needs Logic
  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday
        const hour = now.getHours();

        const sunday = day === 0;
        setIsSunday(sunday);
        
        // Church Open: Sunday 8am - 2pm (14:00)
        const churchOpen = sunday && hour >= 8 && hour < 14;
        setIsChurchOpen(churchOpen);
        isChurchOpenRef.current = churchOpen;

        // Decrease Food (Hunger)
        foodRef.current = Math.max(0, foodRef.current - 0.05);
        setFood(foodRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    if (user?.id) {
        // Coin balance is now handled by useCoins hook with real-time subscriptions
        // No need for manual fetch/subscribe here
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    engineRef.current = engine
    sceneRef.current = scene

    // -- LIGHTING & ENVIRONMENT --
    // HDR Environment Texture (crucial for realistic reflections)
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = envTexture;
    scene.environmentIntensity = 1.0;  // Increased for more realistic indirect lighting
    
    // Secondary environment for additional realism
    scene.ambientColor = new Color3(0.3, 0.35, 0.4);

    // Sun (Directional Light with high quality shadows)
    const sunLight = new DirectionalLight("sun", new Vector3(-0.8, -1.2, -0.8), scene);
    sunLight.intensity = 3.5;  // Increased for more dramatic lighting
    sunLight.position = new Vector3(100, 150, 100);
    sunLight.range = 500;

    // Ambient backup (softer fill light)
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 0.4  // Reduced slightly since we have strong env lighting
    light.groundColor = new Color3(0.04, 0.04, 0.08)
    light.diffuse = new Color3(0.9, 0.9, 1.0);
    light.specular = new Color3(1, 1, 1);

    // Enhanced Shadows with cascading
    const shadowGenerator = new CascadedShadowGenerator(2048, sunLight);  // Increased resolution
    shadowGenerator.transparencyShadow = true;
    shadowGenerator.bias = 0.002;  // Reduced for sharper shadows
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.forceBackFacesOnly = false;
    shadowGenerator.splitFrustum();

    // Sky Material
    const skyMaterial = new SkyMaterial("skyMaterial", scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.turbidity = 10;
    skyMaterial.luminance = 1;
    skyMaterial.inclination = 0; // Updated in loop
    skyMaterial.azimuth = 0.25;
    
    const skyBox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    skyBox.material = skyMaterial;

    // Cloud System
    const cloudSystem = new ParticleSystem("clouds", 2000, scene);
    // Generate cloud texture
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 128;
    cloudCanvas.height = 128;
    const cloudCtx = cloudCanvas.getContext('2d');
    if (cloudCtx) {
        const grad = cloudCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        cloudCtx.fillStyle = grad;
        cloudCtx.fillRect(0, 0, 128, 128);
    }
    cloudSystem.particleTexture = new Texture(cloudCanvas.toDataURL(), scene);
    
    cloudSystem.emitter = new Vector3(0, 100, 0);
    cloudSystem.minEmitBox = new Vector3(-200, 0, -200);
    cloudSystem.maxEmitBox = new Vector3(200, 20, 200);
    
    cloudSystem.color1 = new Color4(1, 1, 1, 0.8);
    cloudSystem.color2 = new Color4(0.9, 0.9, 0.9, 0.6);
    cloudSystem.colorDead = new Color4(0.8, 0.8, 0.8, 0.0);
    
    cloudSystem.minSize = 20.0;
    cloudSystem.maxSize = 60.0;
    
    cloudSystem.minLifeTime = 15.0;
    cloudSystem.maxLifeTime = 30.0;

    cloudSystem.emitRate = 20; // Will vary with weather
    cloudSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    cloudSystem.gravity = new Vector3(0, 0, 0);
    cloudSystem.direction1 = new Vector3(-1, 0, -0.5);
    cloudSystem.direction2 = new Vector3(-1, 0, 0.5);
    cloudSystem.minEmitPower = 0.5;
    cloudSystem.maxEmitPower = 2.0;
    cloudSystem.updateSpeed = 0.005;

    cloudSystem.start();

    const ground = MeshBuilder.CreateGround('ground', { width: 800, height: 800 }, scene)
    const groundMaterial = new PBRMaterial('groundMat', scene)
    const groundTex = new Texture("https://assets.babylonjs.com/textures/grass.png", scene)
    groundTex.uScale = 160
    groundTex.vScale = 160
    groundMaterial.albedoTexture = groundTex
    
    // Enhanced PBR for grass with micro-roughness variation
    groundMaterial.roughness = 0.95
    groundMaterial.metallic = 0.0
    groundMaterial.ambientColor = new Color3(0.2, 0.25, 0.15)
    
    // Add normal map for surface detail
    const grassNormal = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene)
    grassNormal.uScale = 160
    grassNormal.vScale = 160
    groundMaterial.bumpTexture = grassNormal
    
    // Subsurface scattering for grass (transmitted light)
    groundMaterial.subSurface.isRefractionEnabled = true
    groundMaterial.subSurface.refractionIntensity = 0.1
    
    ground.material = groundMaterial
    ground.receiveShadows = true

    // -- Advanced Road & Sidewalk Materials --
    const roadMaterial = new PBRMaterial('roadMat', scene)
    roadMaterial.albedoColor = new Color3(0.05, 0.05, 0.05); // Black asphalt
    const roadAlbedo = new Texture("https://assets.babylonjs.com/textures/asphalt.jpg", scene)
    roadAlbedo.uScale = 5
    roadAlbedo.vScale = 160
    roadAlbedo.level = 0.5; // Darken texture
    roadMaterial.albedoTexture = roadAlbedo
    
    const roadBump = new Texture("https://assets.babylonjs.com/textures/asphalt_normal.jpg", scene)
    roadBump.uScale = 5
    roadBump.vScale = 160
    roadMaterial.bumpTexture = roadBump
    
    // Add roughness texture for variable surface detail
    const roadRoughTex = new Texture("https://assets.babylonjs.com/textures/asphalt_normal.jpg", scene);
    roadRoughTex.uScale = 5;
    roadRoughTex.vScale = 160;

    const roadAmbient = new Texture("https://assets.babylonjs.com/textures/asphalt_normal.jpg", scene);
    roadAmbient.uScale = 5;
    roadAmbient.vScale = 160;
    roadMaterial.ambientTexture = roadAmbient;

    // Enhanced asphalt properties
    roadMaterial.roughness = 0.75  // Wet asphalt is rougher
    roadMaterial.metallic = 0.05   // Slightly metallic from fragments
    roadMaterial.useParallax = true;
    roadMaterial.useParallaxOcclusion = true;
    roadMaterial.parallaxScaleBias = 0.08;
    
    // Add reflectivity for wet roads
    roadMaterial.ambientColor = new Color3(0.05, 0.05, 0.05)
    roadMaterial.alpha = 1.0
    
    // Environment reflection (subtle for asphalt)
    roadMaterial.environmentIntensity = 0.3

    // -- Create Roads (Expanded) --
    const roadMain = MeshBuilder.CreateGround('roadMain', { width: 12, height: 600 }, scene)
    roadMain.position.y = 0.02
    roadMain.material = roadMaterial
    roadMain.receiveShadows = true

    const roadCross = MeshBuilder.CreateGround('roadCross', { width: 600, height: 12 }, scene)
    roadCross.position.y = 0.02
    roadCross.material = roadMaterial
    roadCross.receiveShadows = true

    const sidewalkMaterial = new PBRMaterial('sidewalkMat', scene)
    const sidewalkAlbedo = new Texture("https://assets.babylonjs.com/textures/concrete.jpg", scene)
    sidewalkAlbedo.uScale = 20
    sidewalkAlbedo.vScale = 20
    sidewalkMaterial.albedoTexture = sidewalkAlbedo

    const sidewalkBump = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene); // Bump for concrete
    sidewalkBump.uScale = 20;
    sidewalkBump.vScale = 20;
    sidewalkMaterial.bumpTexture = sidewalkBump;

    // Enhanced concrete properties
    sidewalkMaterial.roughness = 0.85  // Concrete is quite rough
    sidewalkMaterial.metallic = 0.0
    sidewalkMaterial.ambientColor = new Color3(0.3, 0.3, 0.3)
    
    // AO for concrete weathering
    const concreteAO = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene);
    concreteAO.uScale = 20;
    concreteAO.vScale = 20;
    sidewalkMaterial.ambientTexture = concreteAO;


    // Helper to create split sidewalks that don't cross the intersection
    const createSidewalkSegment = (name: string, width: number, depth: number, x: number, z: number) => {
        const swHeight = 0.25 // Taller curb
        const sw = MeshBuilder.CreateBox(name, { width, height: swHeight, depth }, scene)
        sw.position = new Vector3(x, swHeight / 2, z)
        sw.material = sidewalkMaterial
        sw.receiveShadows = true
        return sw
    }

    // Road Main is width 12 (X: -6 to 6). Road Cross is depth 12 (Z: -6 to 6).
    // Sidewalks are width 3.
    // Main Road Sidewalks (run along Z):
    // Left: X = -7.5. Right: X = 7.5.
    // They must stop before Z = -6 and start after Z = 6.
    // Total length 600 (-300 to 300).
    // Segment 1: -300 to -6. Length 294. Center Z = -153.
    // Segment 2: 6 to 300. Length 294. Center Z = 153.

    createSidewalkSegment('sidewalkMainLeft_1', 3, 294, -7.5, -153)
    createSidewalkSegment('sidewalkMainLeft_2', 3, 294, -7.5, 153)
    createSidewalkSegment('sidewalkMainRight_1', 3, 294, 7.5, -153)
    createSidewalkSegment('sidewalkMainRight_2', 3, 294, 7.5, 153)

    // Cross Road Sidewalks (run along X):
    // Top: Z = 7.5. Bottom: Z = -7.5.
    // They must stop before X = -6 and start after X = 6.
    // Segment 1: -300 to -6. Length 294. Center X = -153.
    // Segment 2: 6 to 300. Length 294. Center X = 153.

    createSidewalkSegment('sidewalkCrossTop_1', 294, 3, -153, 7.5)
    createSidewalkSegment('sidewalkCrossTop_2', 294, 3, 153, 7.5)
    createSidewalkSegment('sidewalkCrossBottom_1', 294, 3, -153, -7.5)
    createSidewalkSegment('sidewalkCrossBottom_2', 294, 3, 153, -7.5)

    // Corner fillers (optional, but makes it look nice)
    // The corners are at X > 6, Z > 6 etc.
    // The sidewalks above meet at the corners but leave a 3x3 gap if we strictly follow the logic?
    // SidewalkMainLeft (X -9 to -6) ends at Z=-6.
    // SidewalkCrossBottom (Z -9 to -6) ends at X=-6.
    // The square [-9, -6] x [-9, -6] is covered by the intersection of the two strips if they extended.
    // But since we cut them, we might be missing the corner piece?
    // Actually, createSidewalkSegment('sidewalkMainLeft_1', ...) goes Z -200 to -6.
    // createSidewalkSegment('sidewalkCrossBottom_1', ...) goes X -200 to -6.
    // At X=-7.5, Z=-7.5 (the corner), BOTH exist.
    // So they overlap. This is fine. No gap.
    // The only gap is the road intersection itself.

    const buildings: any[] = []

    // Enhanced street light materials with realistic metal and glass
    const lampPostMat = new PBRMaterial('lampPostMat', scene)
    lampPostMat.albedoColor = new Color3(0.6, 0.6, 0.65)
    lampPostMat.roughness = 0.35  // Smooth for painted metal
    lampPostMat.metallic = 0.9    // Highly metallic
    lampPostMat.ambientColor = new Color3(0.3, 0.3, 0.35)
    
    // Add metallic texture
    const metalTex = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene);
    lampPostMat.bumpTexture = metalTex;

    // Enhanced lamp bulb material with bloom effect
    const lampMat = new PBRMaterial('lampMat', scene)
    lampMat.emissiveColor = new Color3(1, 0.95, 0.8)  // Warm white light
    lampMat.albedoColor = new Color3(0.5, 0.5, 0.4)   // Slightly dark for contrast
    lampMat.roughness = 0.3
    lampMat.metallic = 0.1
    lampMat.emissiveIntensity = 1.2  // Control emissive brightness
    
    // Add brightness/glow texture
    const glowTex = new DynamicTexture('lampGlowTex', 64, scene);
    const glowCtx = glowTex.getContext() as CanvasRenderingContext2D;
    const glowGrad = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    glowGrad.addColorStop(0, 'rgba(255, 240, 200, 1)');
    glowGrad.addColorStop(1, 'rgba(100, 80, 0, 0)');
    glowCtx.fillStyle = glowGrad;
    glowCtx.fillRect(0, 0, 64, 64);
    glowTex.update();
    lampMat.emissiveTexture = glowTex;

    const lampPositions: Vector3[] = []
    for (let z = -280; z <= 280; z += 40) {
      // Exclude intersection center
      if (Math.abs(z) > 20) {
        lampPositions.push(new Vector3(8.5, 0, z))
        lampPositions.push(new Vector3(-8.5, 0, z))
      }
    }
    for (let x = -280; x <= 280; x += 40) {
      // Exclude intersection center
      if (Math.abs(x) > 20) {
        lampPositions.push(new Vector3(x, 0, 8.5))
        lampPositions.push(new Vector3(x, 0, -8.5))
      }
    }

    lampPositions.forEach((pos, index) => {
      const post = MeshBuilder.CreateBox(`streetPost_${index}`, { width: 0.3, height: 6, depth: 0.3 }, scene)
      post.position = new Vector3(pos.x, 3, pos.z)
      post.material = lampPostMat
      buildings.push(post)
      shadowGenerator.addShadowCaster(post)

      const lamp = MeshBuilder.CreateBox(`streetLamp_${index}`, { width: 0.8, height: 0.5, depth: 0.8 }, scene)
      lamp.position = new Vector3(pos.x, 6.2, pos.z)
      lamp.material = lampMat
      shadowGenerator.addShadowCaster(lamp)

      const point = new PointLight(`streetLight_${index}`, new Vector3(pos.x, 6.5, pos.z), scene)
      point.intensity = 0.6
      point.diffuse = new Color3(1, 0.95, 0.8)
      point.range = 30
    })
    
    // -- AI Traffic System --
    const trafficCars: { mesh: Mesh, speed: number, direction: number }[] = [];
    const trafficCount = 25; // Increased for larger map
    
    // -- New Image Vehicle System --
    const createTexturedBoxVehicle = (name: string, vehicleId: number | string | null, parent: Mesh) => {
        const root = new Mesh(name, scene);
        root.parent = parent;
        
        // Find car data
        const idNum = Number(vehicleId);
        const carData = cars.find(c => c.id === idNum) || cars[Math.floor(Math.random() * cars.length)];
        
        // Dimensions - Modern car proportions
        const carLength = 4.5;
        const carHeight = 1.5;
        const carWidth = 1.9;

        // Modern paint material with metallic finishes
        const carColors = [
            { hex: '#FF0000', name: 'Glossy Red' },
            { hex: '#0000FF', name: 'Metallic Blue' },
            { hex: '#00FF00', name: 'Neon Green' },
            { hex: '#FFFF00', name: 'Sun Yellow' },
            { hex: '#FF00FF', name: 'Magenta' },
            { hex: '#00FFFF', name: 'Cyan' },
            { hex: '#FFA500', name: 'Orange' },
            { hex: '#FFFFFF', name: 'Pearl White' },
            { hex: '#1a1a1a', name: 'Matte Black' },
            { hex: '#FF69B4', name: 'Hot Pink' },
            { hex: '#800080', name: 'Purple' },
            { hex: '#FFC0CB', name: 'Pink' }
        ];
        const randomColor = carColors[Math.floor(Math.random() * carColors.length)];
        
        const paintMat = new PBRMaterial(`${name}_paint`, scene);
        paintMat.albedoColor = Color3.FromHexString(randomColor.hex);
        paintMat.metallic = 0.85;
        paintMat.roughness = 0.15;
        paintMat.clearCoat.isEnabled = true;
        paintMat.clearCoat.intensity = 1.2;
        paintMat.clearCoat.roughness = 0.08;
        paintMat.metallicF0Factor = 1.0;

        // Modern car body with better proportions
        const bodyRoot = new Mesh(`${name}_body_root`, scene);
        bodyRoot.parent = root;
        bodyRoot.position.y = carHeight / 2 + 0.5;
        
        // Front hood (sloped)
        const hood = MeshBuilder.CreateBox(`${name}_hood`, { width: carWidth * 0.9, height: carHeight * 0.35, depth: carLength * 0.25 }, scene);
        hood.position = new Vector3(0, carHeight * 0.25, carLength * 0.35);
        hood.parent = bodyRoot;
        hood.material = paintMat;
        
        // Main cabin (larger, more boxy)
        const cabin = MeshBuilder.CreateBox(`${name}_cabin`, { width: carWidth, height: carHeight * 0.65, depth: carLength * 0.55 }, scene);
        cabin.parent = bodyRoot;
        cabin.material = paintMat;
        
        // Rear deck
        const deck = MeshBuilder.CreateBox(`${name}_deck`, { width: carWidth * 0.85, height: carHeight * 0.35, depth: carLength * 0.25 }, scene);
        deck.position = new Vector3(0, carHeight * 0.2, -carLength * 0.35);
        deck.parent = bodyRoot;
        deck.material = paintMat;

        shadowGenerator.addShadowCaster(hood);
        shadowGenerator.addShadowCaster(cabin);
        shadowGenerator.addShadowCaster(deck);

        // Modern glass with tint
        const glassMat = new PBRMaterial(`${name}_glass`, scene);
        glassMat.albedoColor = new Color3(0.15, 0.2, 0.3);
        glassMat.metallic = 0.7;
        glassMat.roughness = 0.1;
        glassMat.alpha = 0.5;
        glassMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        
        // Front windshield
        const windshieldF = MeshBuilder.CreatePlane(`${name}_windshield_f`, { width: carWidth * 0.85, height: carHeight * 0.4 }, scene);
        windshieldF.position = new Vector3(0, carHeight * 0.3, carLength * 0.25);
        windshieldF.rotation.x = 0.3;
        windshieldF.parent = bodyRoot;
        windshieldF.material = glassMat;
        
        // Rear windshield
        const windshieldR = MeshBuilder.CreatePlane(`${name}_windshield_r`, { width: carWidth * 0.8, height: carHeight * 0.35 }, scene);
        windshieldR.position = new Vector3(0, carHeight * 0.25, -carLength * 0.25);
        windshieldR.rotation.x = -0.25;
        windshieldR.parent = bodyRoot;
        windshieldR.material = glassMat;
        
        // Side windows (left)
        const windowL = MeshBuilder.CreatePlane(`${name}_window_l`, { width: carLength * 0.4, height: carHeight * 0.35 }, scene);
        windowL.position = new Vector3(-carWidth/2 - 0.05, carHeight * 0.3, 0);
        windowL.rotation.y = Math.PI / 2;
        windowL.parent = bodyRoot;
        windowL.material = glassMat;
        
        // Side windows (right)
        const windowR = MeshBuilder.CreatePlane(`${name}_window_r`, { width: carLength * 0.4, height: carHeight * 0.35 }, scene);
        windowR.position = new Vector3(carWidth/2 + 0.05, carHeight * 0.3, 0);
        windowR.rotation.y = Math.PI / 2;
        windowR.parent = bodyRoot;
        windowR.material = glassMat;

        // Modern alloy wheels
        const rimMat = new PBRMaterial(`${name}_rim`, scene);
        rimMat.albedoColor = new Color3(0.75, 0.75, 0.78);
        rimMat.metallic = 0.9;
        rimMat.roughness = 0.25;
        
        const tireMat = new PBRMaterial(`${name}_tire`, scene);
        tireMat.albedoColor = new Color3(0.02, 0.02, 0.02);
        tireMat.roughness = 0.95;
        
        const wheelPositions = [
            { x: -carWidth/2 - 0.1, z: carLength/2.5 },
            { x: carWidth/2 + 0.1, z: carLength/2.5 },
            { x: -carWidth/2 - 0.1, z: -carLength/2.5 },
            { x: carWidth/2 + 0.1, z: -carLength/2.5 },
        ];
        
        wheelPositions.forEach((pos, i) => {
            // Tire
            const tire = MeshBuilder.CreateCylinder(`${name}_tire${i}`, { diameter: 0.85, height: 0.35 }, scene);
            tire.rotation.z = Math.PI / 2;
            tire.position = new Vector3(pos.x, 0.42, pos.z);
            tire.parent = root;
            tire.material = tireMat;
            
            // Rim (inside tire)
            const rim = MeshBuilder.CreateCylinder(`${name}_rim${i}`, { diameter: 0.55, height: 0.35 }, scene);
            rim.rotation.z = Math.PI / 2;
            rim.position = new Vector3(pos.x, 0.42, pos.z);
            rim.parent = root;
            rim.material = rimMat;
            
            shadowGenerator.addShadowCaster(tire);
        });

        // Bumpers and trim
        const trimMat = new PBRMaterial(`${name}_trim`, scene);
        trimMat.albedoColor = new Color3(0.1, 0.1, 0.1);
        trimMat.roughness = 0.5;
        
        // Front bumper
        const bumperF = MeshBuilder.CreateBox(`${name}_bumper_f`, { width: carWidth * 0.95, height: carHeight * 0.2, depth: 0.35 }, scene);
        bumperF.position = new Vector3(0, -carHeight * 0.35, carLength * 0.45);
        bumperF.parent = bodyRoot;
        bumperF.material = trimMat;
        
        // Rear bumper
        const bumperR = MeshBuilder.CreateBox(`${name}_bumper_r`, { width: carWidth * 0.9, height: carHeight * 0.2, depth: 0.35 }, scene);
        bumperR.position = new Vector3(0, -carHeight * 0.35, -carLength * 0.45);
        bumperR.parent = bodyRoot;
        bumperR.material = trimMat;

        // Add dummy doors for compatibility
        const doorL = new Mesh(`${name}_doorL`, scene); doorL.parent = root;
        const doorR = new Mesh(`${name}_doorR`, scene); doorR.parent = root;
        
        return { root, doorL, doorR };
    };

    // -- Vehicle System --
    const createMidPolyVehicle = (name: string, type: 'sedan' | 'suv' | 'truck', color: Color3, parent: Mesh) => {
        const root = new Mesh(name, scene);
        root.parent = parent;

        // Materials - Max Detail
        const paintMat = new PBRMaterial(`${name}_paint`, scene);
        paintMat.albedoColor = color;
        paintMat.metallic = 0.8; // More metallic
        paintMat.roughness = 0.2; // Shinier
        paintMat.clearCoat.isEnabled = true;
        paintMat.clearCoat.intensity = 1.0;
        paintMat.clearCoat.roughness = 0.1;
        // Flakes for metallic paint effect
        paintMat.metallicF0Factor = 1.0;

        const glassMat = new PBRMaterial(`${name}_glass`, scene);
        glassMat.albedoColor = new Color3(0.05, 0.05, 0.1);
        glassMat.metallic = 1.0;
        glassMat.roughness = 0.0;
        glassMat.alpha = 0.4;
        glassMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;

        const trimMat = new PBRMaterial(`${name}_trim`, scene);
        trimMat.albedoColor = new Color3(0.05, 0.05, 0.05);
        trimMat.metallic = 0.1;
        trimMat.roughness = 0.5;

        const chromeMat = new PBRMaterial(`${name}_chrome`, scene);
        chromeMat.albedoColor = new Color3(0.9, 0.9, 0.9);
        chromeMat.metallic = 1.0;
        chromeMat.roughness = 0.1;

        const tireMat = new PBRMaterial(`${name}_tire`, scene);
        tireMat.albedoColor = new Color3(0.02, 0.02, 0.02);
        tireMat.roughness = 0.9;
        tireMat.metallic = 0.0;

        const rimMat = new PBRMaterial(`${name}_rim`, scene);
        rimMat.albedoColor = new Color3(0.8, 0.8, 0.85);
        rimMat.metallic = 0.9;
        rimMat.roughness = 0.2;

        // Profile Geometry based on Type
        let width = 2.0;
        let length = 4.5;
        let height = 1.4;
        const wheelRadius = 0.35;
        
        // Define side profile (Y, Z) for extrusion along X
        // Centered at bottom (Y=0)
        let roofY = 0;
        let hoodY = 0;

        if (type === 'sedan') {
            width = 1.9; length = 4.6; height = 1.4;
            roofY = 1.4; hoodY = 0.75;
        } else if (type === 'suv') {
            width = 2.1; length = 4.8; height = 1.7;
            roofY = 1.7; hoodY = 0.95;
        } else if (type === 'truck') {
            width = 2.2; length = 5.2; height = 1.8;
            roofY = 1.8; hoodY = 1.0;
        }

        // 1. Main Chassis (Bottom) - Smoothed
        const chassis = MeshBuilder.CreateBox(`${name}_chassis`, { width, height: hoodY, depth: length }, scene);
        chassis.position.y = hoodY / 2 + 0.3;
        chassis.material = paintMat;
        chassis.parent = root;
        shadowGenerator.addShadowCaster(chassis);

        // Add Grill
        const grille = MeshBuilder.CreateBox(`${name}_grille`, { width: width * 0.7, height: hoodY * 0.4, depth: 0.1 }, scene);
        grille.position = new Vector3(0, 0.4, length/2 + 0.05);
        grille.parent = root;
        grille.material = trimMat;

        // Add Bumpers
        const bumperF = MeshBuilder.CreateBox(`${name}_bumperF`, { width: width + 0.1, height: 0.3, depth: 0.2 }, scene);
        bumperF.position = new Vector3(0, 0.3, length/2 + 0.1);
        bumperF.parent = root;
        bumperF.material = chromeMat; // Chrome bumpers

        const bumperR = MeshBuilder.CreateBox(`${name}_bumperR`, { width: width + 0.1, height: 0.3, depth: 0.2 }, scene);
        bumperR.position = new Vector3(0, 0.3, -length/2 - 0.1);
        bumperR.parent = root;
        bumperR.material = chromeMat;

        // 2. Cabin (Top)
        let cabinDepth = length * 0.5;
        let cabinZ = 0;
        if (type === 'sedan') { cabinDepth = length * 0.4; cabinZ = -0.2; }
        if (type === 'truck') { cabinDepth = length * 0.25; cabinZ = 0; }
        if (type === 'suv') { cabinDepth = length * 0.7; cabinZ = -0.4; }

        const cabin = MeshBuilder.CreateBox(`${name}_cabin`, { width: width * 0.85, height: roofY - hoodY, depth: cabinDepth }, scene);
        cabin.position.y = hoodY + (roofY - hoodY) / 2 + 0.3;
        cabin.position.z = cabinZ;
        cabin.material = paintMat;
        cabin.parent = root;
        shadowGenerator.addShadowCaster(cabin);

        // Windows (Decals/Planes)
        const windshield = MeshBuilder.CreatePlane(`${name}_windshield`, { width: width * 0.8, height: (roofY - hoodY) * 1.1 }, scene);
        windshield.parent = cabin;
        windshield.position.z = cabinDepth / 2 + 0.01;
        windshield.rotation.x = -Math.PI / 6; // Slanted
        windshield.material = glassMat;

        // Wheels
        const wheelPositions = [
            { x: -width/2 + 0.1, z: length/2 - 0.8, isFront: true },
            { x: width/2 - 0.1, z: length/2 - 0.8, isFront: true },
            { x: -width/2 + 0.1, z: -length/2 + 0.8, isFront: false },
            { x: width/2 - 0.1, z: -length/2 + 0.8, isFront: false },
        ];

        wheelPositions.forEach((pos, i) => {
            // Wheel Pivot (for steering)
            const wheelPivot = new Mesh(`${name}_wheel_pivot_${i}`, scene);
            wheelPivot.position = new Vector3(pos.x, wheelRadius, pos.z);
            wheelPivot.parent = root;
            
            // Actual Wheel Mesh
            const wheel = MeshBuilder.CreateCylinder(`${name}_wheel_${i}`, { diameter: wheelRadius * 2, height: 0.4, tessellation: 24 }, scene);
            wheel.rotation.z = Math.PI / 2;
            wheel.material = tireMat;
            wheel.parent = wheelPivot;
            shadowGenerator.addShadowCaster(wheel);
            
            // Rim
            const rim = MeshBuilder.CreateCylinder(`${name}_rim_${i}`, { diameter: wheelRadius * 1.2, height: 0.42, tessellation: 16 }, scene);
            rim.rotation.z = Math.PI / 2;
            rim.material = rimMat;
            rim.parent = wheelPivot;

            // Store ref for steering animation
            if (pos.isFront) {
                if (!(root as any).frontWheels) (root as any).frontWheels = [];
                (root as any).frontWheels.push(wheelPivot);
            } else {
                if (!(root as any).rearWheels) (root as any).rearWheels = [];
                (root as any).rearWheels.push(wheelPivot); // Rear wheels usually don't steer but might spin
            }
            // Store all for rolling
            if (!(root as any).allWheels) (root as any).allWheels = [];
            (root as any).allWheels.push({ mesh: wheel, rim: rim }); // Spin the mesh inside pivot
        });

        // Doors (Left and Right)
        const doorWidth = 0.2;
        const doorHeight = height * 0.6;
        const doorLength = length * 0.3;
        
        const doorL = new Mesh(`${name}_doorL_pivot`, scene);
        doorL.parent = root;
        doorL.position = new Vector3(-width/2 - 0.05, hoodY, 0.2); // Hinge location
        
        const doorLMesh = MeshBuilder.CreateBox(`${name}_doorL_mesh`, { width: doorWidth, height: doorHeight, depth: doorLength }, scene);
        doorLMesh.parent = doorL;
        doorLMesh.position = new Vector3(0, 0, -doorLength / 2); 
        doorLMesh.material = paintMat;
        shadowGenerator.addShadowCaster(doorLMesh);

        // Right Door
        const doorR = new Mesh(`${name}_doorR_pivot`, scene);
        doorR.parent = root;
        doorR.position = new Vector3(width/2 + 0.05, hoodY, 0.2);
        
        const doorRMesh = MeshBuilder.CreateBox(`${name}_doorR_mesh`, { width: doorWidth, height: doorHeight, depth: doorLength }, scene);
        doorRMesh.parent = doorR;
        doorRMesh.position = new Vector3(0, 0, -doorLength / 2);
        doorRMesh.material = paintMat;
        shadowGenerator.addShadowCaster(doorRMesh);

        return { root, doorL, doorR };
    };
    


    for (let i = 0; i < trafficCount; i++) {
        const isRightSide = Math.random() > 0.5;
        const xPos = isRightSide ? 3 : -3; // Lanes
        const zPos = (Math.random() - 0.5) * 560; // Expanded bounds for larger map
        const speed = 5 + Math.random() * 5;
        const direction = isRightSide ? 1 : -1; // Right side goes forward (Z+), Left goes back (Z-)
        
        // Create Mesh (Simplified Car)
        const trafficRoot = new Mesh(`traffic_${i}`, scene);
        trafficRoot.position = new Vector3(xPos, 0, zPos);
        trafficRoot.rotation.y = isRightSide ? 0 : Math.PI;
        
        // Use our vehicle generator!
        const randCar = cars[Math.floor(Math.random() * cars.length)];
        createTexturedBoxVehicle(`traffic_vis_${i}`, randCar.id, trafficRoot);
        
        trafficCars.push({ mesh: trafficRoot, speed, direction });
        
        // Add collision box
        trafficRoot.checkCollisions = true;
        buildings.push(trafficRoot); // Add to collision list
    }
    
    // -- Environment Polish --
    // Add some street props (Trash cans, Benches)
    const propMat = new PBRMaterial('propMat', scene);
    propMat.albedoColor = new Color3(0.2, 0.3, 0.2);
    propMat.roughness = 0.8;
    
    for (let z = -280; z < 280; z += 40) {
        if (Math.abs(z) < 20) continue;
        
        // Trash Can
        const trash = MeshBuilder.CreateCylinder(`trash_${z}`, { diameter: 0.6, height: 0.8 }, scene);
        trash.position = new Vector3(8, 0.4, z + 5);
        trash.material = propMat;
        shadowGenerator.addShadowCaster(trash);
        
        // Bench
        const bench = MeshBuilder.CreateBox(`bench_${z}`, { width: 2, height: 0.5, depth: 0.6 }, scene);
        bench.position = new Vector3(8, 0.25, z + 10);
        bench.material = propMat;
        shadowGenerator.addShadowCaster(bench);
    }

    // -- Traffic System (Enhanced PBR) --
    const trafficPoleMat = new PBRMaterial('trafficPoleMat', scene)
    trafficPoleMat.albedoColor = new Color3(0.25, 0.25, 0.28)
    trafficPoleMat.roughness = 0.35  // Smooth painted metal
    trafficPoleMat.metallic = 0.85   // Highly metallic
    trafficPoleMat.ambientColor = new Color3(0.15, 0.15, 0.18)

    const cableMat = new PBRMaterial('cableMat', scene)
    cableMat.albedoColor = new Color3(0.08, 0.08, 0.08)
    cableMat.roughness = 0.9  // Rough insulated cable
    cableMat.metallic = 0.0

    const housingMat = new PBRMaterial('trafficHousingMat', scene)
    housingMat.albedoColor = new Color3(0.95, 0.8, 0.1) // Yellow housing
    housingMat.roughness = 0.3   // Glossy painted plastic
    housingMat.metallic = 0.05
    housingMat.emissiveIntensity = 0.2

    // Enhanced traffic lights with stronger emissive properties
    const lightRedMat = new PBRMaterial('trafficRedMat', scene)
    lightRedMat.emissiveColor = new Color3(1, 0.2, 0.1)  // Deep red glow
    lightRedMat.albedoColor = new Color3(0.15, 0.02, 0)
    lightRedMat.roughness = 0.1    // Smooth glass
    lightRedMat.metallic = 0.9     // Reflective
    lightRedMat.emissiveIntensity = 1.5

    const lightYellowMat = new PBRMaterial('trafficYellowMat', scene)
    lightYellowMat.emissiveColor = new Color3(1, 0.9, 0.2)  // Bright amber
    lightYellowMat.albedoColor = new Color3(0.2, 0.15, 0)
    lightYellowMat.roughness = 0.1
    lightYellowMat.metallic = 0.9
    lightYellowMat.emissiveIntensity = 1.4

    const lightGreenMat = new PBRMaterial('trafficGreenMat', scene)
    lightGreenMat.emissiveColor = new Color3(0.2, 1, 0.5)  // Bright green
    lightGreenMat.albedoColor = new Color3(0, 0.15, 0.05)
    lightGreenMat.roughness = 0.1
    lightGreenMat.metallic = 0.9
    lightGreenMat.emissiveIntensity = 1.3

    const createTrafficLightPrefab = (name: string, parent: Mesh) => {
        const housing = MeshBuilder.CreateBox(`${name}_housing`, { width: 0.5, height: 1.5, depth: 0.4 }, scene)
        housing.material = housingMat
        housing.parent = parent
        housing.position.y = -0.8 // Hang down from cable

        // Wire connecting to cable
        const wire = MeshBuilder.CreateCylinder(`${name}_wire`, { diameter: 0.05, height: 0.5 }, scene)
        wire.material = cableMat
        wire.parent = parent
        wire.position.y = 0.2 // Between cable and housing

        // Lights
        const lightGeo = { diameter: 0.3, segments: 16 }
        
        const red = MeshBuilder.CreateSphere(`${name}_red`, lightGeo, scene)
        red.parent = housing
        red.position = new Vector3(0, 0.4, -0.15)
        red.scaling.z = 0.5
        red.material = lightRedMat

        const yellow = MeshBuilder.CreateSphere(`${name}_yellow`, lightGeo, scene)
        yellow.parent = housing
        yellow.position = new Vector3(0, 0, -0.15)
        yellow.scaling.z = 0.5
        yellow.material = lightYellowMat

        const green = MeshBuilder.CreateSphere(`${name}_green`, lightGeo, scene)
        green.parent = housing
        green.position = new Vector3(0, -0.4, -0.15)
        green.scaling.z = 0.5
        green.material = lightGreenMat

        // Hoods (optional, for realism)
        const hood = MeshBuilder.CreateBox(`${name}_hood`, { width: 0.4, height: 0.05, depth: 0.3 }, scene)
        hood.parent = housing
        hood.position = new Vector3(0, 0.6, -0.25)
        hood.material = housingMat

        return housing
    }

    const createIntersection = () => {
        const poleHeight = 8
        const poleOffset = 9 // Sidewalk corners
        const stopLineOffset = 8 // Z or X position of stop line
        const laneOffset = 3 // Center of lane

        // Poles at 4 corners
        const corners = [
            new Vector3(-poleOffset, 0, -poleOffset), // SW
            new Vector3(poleOffset, 0, -poleOffset),  // SE
            new Vector3(-poleOffset, 0, poleOffset),  // NW
            new Vector3(poleOffset, 0, poleOffset)    // NE
        ]

        corners.forEach((pos, i) => {
            const pole = MeshBuilder.CreateBox(`trafficPole_${i}`, { width: 0.4, height: poleHeight, depth: 0.4 }, scene)
            pole.position = new Vector3(pos.x, poleHeight / 2, pos.z)
            pole.material = trafficPoleMat
            pole.receiveShadows = true
            shadowGenerator.addShadowCaster(pole)
            buildings.push(pole)
        })

        // Suspension Cables
        // 1. Southbound Traffic (Coming from +Z, stops at Z=8). Light faces +Z (North).
        // Cable spans X: -9 to +9 at Z=8.
        const cableSouth = MeshBuilder.CreateTube("cable_south_bound", {
            path: [new Vector3(-poleOffset, poleHeight - 0.5, stopLineOffset), new Vector3(poleOffset, poleHeight - 0.5, stopLineOffset)],
            radius: 0.05,
        }, scene)
        cableSouth.material = cableMat

        // Light for Southbound (Lane X = -3)
        // Position: X=-3, Z=8. Faces North (rotation Y = PI)
        const lightSBNode = new Mesh("light_SB_node", scene)
        lightSBNode.position = new Vector3(-laneOffset, poleHeight - 0.5, stopLineOffset)
        lightSBNode.parent = cableSouth
        // Rotate housing to face traffic. Traffic moves -Z. Light faces +Z (North).
        // Housing defaults to facing -Z (lights at -0.15).
        // If we rotate Y=PI, lights will be at +0.15 (facing North).
        lightSBNode.rotation.y = Math.PI 
        createTrafficLightPrefab("light_SB", lightSBNode)


        // 2. Northbound Traffic (Coming from -Z, stops at Z=-8). Light faces -Z (South).
        // Cable spans X: -9 to +9 at Z=-8.
        const cableNorth = MeshBuilder.CreateTube("cable_north_bound", {
            path: [new Vector3(-poleOffset, poleHeight - 0.5, -stopLineOffset), new Vector3(poleOffset, poleHeight - 0.5, -stopLineOffset)],
            radius: 0.05,
        }, scene)
        cableNorth.material = cableMat

        // Light for Northbound (Lane X = 3)
        // Position: X=3, Z=-8. Faces South (rotation Y = 0).
        const lightNBNode = new Mesh("light_NB_node", scene)
        lightNBNode.position = new Vector3(laneOffset, poleHeight - 0.5, -stopLineOffset)
        lightNBNode.parent = cableNorth
        // Default faces -Z (South). Correct.
        createTrafficLightPrefab("light_NB", lightNBNode)


        // 3. Westbound Traffic (Coming from +X, stops at X=8). Light faces +X (East).
        // Cable spans Z: -9 to +9 at X=8.
        const cableWest = MeshBuilder.CreateTube("cable_west_bound", {
            path: [new Vector3(stopLineOffset, poleHeight - 0.5, -poleOffset), new Vector3(stopLineOffset, poleHeight - 0.5, poleOffset)],
            radius: 0.05,
        }, scene)
        cableWest.material = cableMat

        // Light for Westbound (Lane Z = 3)
        // Position: X=8, Z=3. Faces East (rotation Y = PI/2).
        const lightWBNode = new Mesh("light_WB_node", scene)
        lightWBNode.position = new Vector3(stopLineOffset, poleHeight - 0.5, laneOffset)
        lightWBNode.parent = cableWest
        lightWBNode.rotation.y = -Math.PI / 2 // -90 deg -> Faces +X
        createTrafficLightPrefab("light_WB", lightWBNode)


        // 4. Eastbound Traffic (Coming from -X, stops at X=-8). Light faces -X (West).
        // Cable spans Z: -9 to +9 at X=-8.
        const cableEast = MeshBuilder.CreateTube("cable_east_bound", {
            path: [new Vector3(-stopLineOffset, poleHeight - 0.5, -poleOffset), new Vector3(-stopLineOffset, poleHeight - 0.5, poleOffset)],
            radius: 0.05,
        }, scene)
        cableEast.material = cableMat

        // Light for Eastbound (Lane Z = -3)
        // Position: X=-8, Z=-3. Faces West (rotation Y = -PI/2 or 3PI/2).
        const lightEBNode = new Mesh("light_EB_node", scene)
        lightEBNode.position = new Vector3(-stopLineOffset, poleHeight - 0.5, -laneOffset)
        lightEBNode.parent = cableEast
        lightEBNode.rotation.y = Math.PI / 2 // +90 deg -> Faces -X
        createTrafficLightPrefab("light_EB", lightEBNode)
    }

    createIntersection()

    const createHouseMat = (name: string, color: Color3, emissive?: Color3) => {
        const mat = new PBRMaterial(name, scene);
        mat.albedoColor = color;
        
        // Add high-quality brick texture for realism
        const brickTex = new Texture("https://assets.babylonjs.com/textures/brick.jpg", scene);
        brickTex.uScale = 2;
        brickTex.vScale = 2;
        mat.albedoTexture = brickTex;
        
        // Add normal map for brick surface detail
        const brickNormal = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene);
        brickNormal.uScale = 2;
        brickNormal.vScale = 2;
        mat.bumpTexture = brickNormal;
        
        // Enhanced PBR properties for brickwork
        mat.roughness = 0.75;  // Brick is moderately rough
        mat.metallic = 0.05;   // Slight metallic for oxidation
        mat.ambientColor = new Color3(0.2, 0.2, 0.2);
        
        // Add subsurface for aged appearance
        mat.subSurface.isTranslucencyEnabled = true;
        mat.subSurface.translucencyIntensity = 0.05;
        
        if (emissive) {
            mat.emissiveColor = emissive;
            mat.emissiveIntensity = 0.8;  // Control emissive strength
        }
        
        return mat;
    };

    const houseMaterials: Record<string, PBRMaterial> = {
        'starter': createHouseMat('houseMatStarter', new Color3(0.6, 0.4, 0.3)),
        'mid': createHouseMat('houseMatMid', new Color3(0.55, 0.35, 0.3)),
        'luxury': createHouseMat('houseMatLuxury', new Color3(0.7, 0.55, 0.35), new Color3(0.15, 0.12, 0.07)),
        'mansion': createHouseMat('houseMatMansion', new Color3(0.65, 0.3, 0.25)),
        'mega': createHouseMat('houseMatMega', new Color3(0.2, 0.2, 0.23), new Color3(0.2, 0.8, 1)),
        'apartment': createHouseMat('houseMatApartment', new Color3(0.5, 0.5, 0.55)),
        'owned': createHouseMat('houseMatOwned', new Color3(0.35, 0.75, 0.4), new Color3(0.1, 0.4, 0.2))
    };

    const windowTemplate = MeshBuilder.CreateBox('windowTemplate', { width: 0.9, height: 1, depth: 0.08 }, scene)
    const windowMat = new PBRMaterial('windowMat', scene)
    windowMat.albedoColor = new Color3(0.7, 0.85, 1)
    windowMat.emissiveColor = new Color3(0.4, 0.6, 0.9)
    windowMat.roughness = 0.2
    windowMat.metallic = 0.8
    windowTemplate.material = windowMat
    windowTemplate.isVisible = false

    let carBodyColor = new Color3(0.7, 0.1, 0.2)
    // const carAccentColor = new Color3(0.2, 0.2, 0.2) // Unused
    let carTierLabel = 'Starter'
    let carStyleLabel = ''
    let carModelUrl: string | null = null

    if (user?.id) {
      const key = `trollcity_car_${user.id}`
      const raw = localStorage.getItem(key)
      if (raw) {
        try {
          const stored = JSON.parse(raw)
          if (stored && typeof stored === 'object') {
            if (typeof stored.colorFrom === 'string') {
              const hex = stored.colorFrom.replace('#', '')
              const num = parseInt(hex, 16)
              if (!Number.isNaN(num)) {
                const r = ((num >> 16) & 255) / 255
                const g = ((num >> 8) & 255) / 255
                const b = (num & 255) / 255
                carBodyColor = new Color3(r, g, b)
              }
            }
            if (typeof stored.colorTo === 'string') {
              const hex = stored.colorTo.replace('#', '')
              const num = parseInt(hex, 16)
              if (!Number.isNaN(num)) {
                // const r = ((num >> 16) & 255) / 255
                // const g = ((num >> 8) & 255) / 255
                // const b = (num & 255) / 255
                // carAccentColor = new Color3(r, g, b) // Unused
              }
            }
            if (typeof stored.tier === 'string') {
              carTierLabel = stored.tier
            }
            if (typeof stored.name === 'string') {
              carStyleLabel = stored.name
            }
            if (typeof stored.modelUrl === 'string') {
              carModelUrl = stored.modelUrl
            }
          }
        } catch {
        }
      }
    }

    let carWidth = 2
    let carLength = 4
    // Unused vars: carHeight, cabinHeight, rideHeight, wheelDiameter removed
    if (carTierLabel.toLowerCase().includes('high') || carTierLabel.toLowerCase().includes('apex')) {
      carLength = 4.5
    } else if (carTierLabel.toLowerCase().includes('mid')) {
      carWidth = 2.1
      carLength = 4.4
    } else if (carStyleLabel.toLowerCase().includes('titan')) {
      carWidth = 2.4
      carLength = 4.8
    }

    const carBody = MeshBuilder.CreateBox('carBody', { width: carWidth, height: 1, depth: carLength }, scene)
    carBody.position = new Vector3(0, 0.6, -10)
    carBody.isVisible = false // Use visible mesh child instead
    carBody.checkCollisions = true

    // -- Vehicle System --


    // Replaces createCarVisuals
    const createPlayerVehicle = async (parent: Mesh, modelUrl: string | null) => {
        // Clear existing children
        parent.getChildren().forEach(c => c.dispose());

        if (modelUrl) {
            try {
                // Determine rootUrl and filename
                const lastSlash = modelUrl.lastIndexOf('/');
                const rootUrl = lastSlash >= 0 ? modelUrl.substring(0, lastSlash + 1) : "./";
                const filename = lastSlash >= 0 ? modelUrl.substring(lastSlash + 1) : modelUrl;

                const result = await SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);
                const root = result.meshes[0];
                root.parent = parent;
                
                // Normalize transform
                root.position = Vector3.Zero();
                root.rotation = Vector3.Zero();
                
                // Attempt to find doors for animation
                const doorL = result.meshes.find(m => m.name.toLowerCase().includes('door') && m.name.toLowerCase().includes('l'));
                const doorR = result.meshes.find(m => m.name.toLowerCase().includes('door') && m.name.toLowerCase().includes('r'));
                
                (parent as any).doorL = doorL;
                (parent as any).doorR = doorR;

                shadowGenerator.addShadowCaster(root, true);
                
                return;
            } catch (err) {
                console.error("Failed to load car model, falling back to procedural", err);
                toast.error("Failed to load custom car model");
            }
        }
        
        // Default to a red sedan for player
        // Check for default model file (mock check)
        // If we want to replace procedural car, we can try loading a default GLB here.
        // But for now, let's keep the procedural fallback but improved?
        // Actually, let's try to load 'default_car.glb' if it exists, else procedural.
        // Since we can't check file existence easily in browser without 404, we'll try/catch inside SceneLoader.
        
        // However, we want to ensure the player has a car.
        // Let's stick to procedural fallback but invoke it ONLY if model load fails.
        // But the code above already does that if 'modelUrl' is provided.
        // If no modelUrl, we want to try a default model?
        const defaultModelUrl = "models/cars/default_sedan.glb"; // Hypothetical default
        
        // Try loading default model if no custom one
        /*
        if (!modelUrl) {
             try {
                 await SceneLoader.ImportMeshAsync("", "models/cars/", "default_sedan.glb", scene);
                 // ... setup
                 return;
             } catch {
                 // Fallback
             }
        }
        */

        // Use custom textured vehicle
        const matchedCar = cars.find(c => c.name === carStyleLabel) || cars[0];
        console.log("Creating player vehicle:", matchedCar.name);
        
        const { doorL, doorR } = createTexturedBoxVehicle("playerCar", matchedCar.id, parent);
        
        // Store door refs for animation
        (parent as any).doorL = doorL;
        (parent as any).doorR = doorR;
    };

    createPlayerVehicle(carBody as Mesh, carModelUrl);
    
    // Expose createMidPolyVehicle to a ref so we can use it outside
    // Actually, simpler: define it outside, or use a ref to store the function.
    // But createMidPolyVehicle depends on 'scene'.
    // So let's just spawn the parked cars HERE, inside this useEffect, using the 'parkedCars' data from state?
    // But 'parkedCars' is state, it might be empty on first render of this effect if the state setter is async.
    // However, the initial state is empty, and the effect to set it runs on mount.
    // This main effect also runs on mount. Race condition.
    // Better: Just generate the parked cars HERE inside this main effect directly, and update the state just for UI if needed.
    // But the state 'parkedCars' is used for rendering? No, we render meshes directly.
    // Let's just do it all here and sync to state if needed.
    
    // Generate parked cars logic (local)
    // We want to generate houses NEXT to these cars.
    // So let's create a list of parked spots, and for each spot, we might generate a house if there's space?
    // Actually, user asked: "where each car is besides my user car place a random house whih will be other users properties"
    // This implies dynamically creating "fake" other user properties near parked cars?
    // Or just visualizing existing multiplayer users?
    // "whih will be other users properties also allowing anyone in troll city to join the same map and see each other as well"
    // This suggests:
    // 1. Multiplayer visualization (already implemented via 'ghostMeshesRef' and 'town_player_state').
    // 2. Procedural houses near parked cars (which act as "other users' houses").
    
    // Let's modify the parked car loop to also spawn a "House" next to it if no house exists there.
    
    const localParkedCars: { id: string, vehicleId: number, position: Vector3, rotation: number }[] = [];
    const colors = [
        new Color3(0.1, 0.1, 0.1), new Color3(0.8, 0.8, 0.8), new Color3(0.6, 0.1, 0.1),
        new Color3(0.1, 0.2, 0.6), new Color3(0.1, 0.5, 0.2), new Color3(0.7, 0.7, 0.1)
    ];

    // Additional houses generated from parked cars
    const extraHouses: TownHouse[] = [];

    for(let z = -180; z <= 180; z += 30) {
        if (Math.abs(z) < 30) continue;
        
        // Right Side (X=10) -> House at X=25?
        if (Math.random() > 0.4) {
            const carId = `parked_R_${z}`;
            const randVehicle = cars[Math.floor(Math.random() * cars.length)];
            localParkedCars.push({
                id: carId,
                vehicleId: randVehicle.id,
                position: new Vector3(10, 0, z),
                rotation: 0
            });
            
            // Add a "User House" here if not occupied
            // Check if a real house exists nearby?
            // For simplicity, we add a visual-only house or a "fake" TownHouse entry
            extraHouses.push({
                id: `user_house_${carId}`,
                owner_user_id: `fake_user_${z}`,
                parcel_id: `parcel_${z}`,
                position_x: 25, // Set back from road
                position_z: z,
                parcel_center_x: 25,
                parcel_center_z: z,
                parcel_size_x: 12,
                parcel_size_z: 12,
                metadata: { visual_tier: 'mid', defense_rating: 1 },
                owner_username: `Citizen_${Math.floor(Math.random()*9000)}`,
                is_own: false,
                last_raid_at: null,
                last_raid_outcome: null
            });
        }
        
        // Left Side (X=-10) -> House at X=-25?
        if (Math.random() > 0.4) {
            const carId = `parked_L_${z}`;
            const randVehicle = cars[Math.floor(Math.random() * cars.length)];
            localParkedCars.push({
                id: carId,
                vehicleId: randVehicle.id,
                position: new Vector3(-10, 0, z),
                rotation: Math.PI
            });
            
             extraHouses.push({
                id: `user_house_${carId}`,
                owner_user_id: `fake_user_neg_${z}`,
                parcel_id: `parcel_neg_${z}`,
                position_x: -25, // Set back from road
                position_z: z,
                parcel_center_x: -25,
                parcel_center_z: z,
                parcel_size_x: 12,
                parcel_size_z: 12,
                metadata: { visual_tier: 'mid', defense_rating: 1 },
                owner_username: `Citizen_${Math.floor(Math.random()*9000)}`,
                is_own: false,
                last_raid_at: null,
                last_raid_outcome: null
            });
        }
    }
    
    // Spawn them
    localParkedCars.forEach(car => {
        const anchor = new Mesh(`anchor_${car.id}`, scene);
        anchor.position = car.position;
        anchor.rotation.y = car.rotation;
        
        const visuals = createTexturedBoxVehicle(car.id, car.vehicleId, anchor);
        parkedCarMeshesRef.current.set(car.id, { ...visuals, root: anchor });
        
        anchor.checkCollisions = true;
        buildings.push(anchor);
    });
    
    // Sync to state (optional, if we need it for React UI)
    // setParkedCars(localParkedCars); // We can skip this if only 3D needs it. But let's keep it clean.
    

    // -- Mid-Poly Character (Upgraded to GTA Style) --
    const createMidPolyCharacter = (parent: Mesh, appearance: typeof characterAppearance) => {
        // Clear children
        parent.getChildren().forEach(c => c.dispose());

        // Use more detailed geometry
        const height = 1.8;
        const width = 0.5;

        // Materials
        const skinMat = new PBRMaterial('skinMat', scene);
        skinMat.albedoColor = appearance.skinColor;
        skinMat.roughness = 0.6;
        skinMat.metallic = 0.0;
        skinMat.subSurface.isRefractionEnabled = true; // Fake SSS

        const topMat = new PBRMaterial('topMat', scene);
        topMat.albedoColor = appearance.topColor;
        topMat.roughness = 0.9;
        topMat.metallic = 0.1;

        const pantMat = new PBRMaterial('pantMat', scene);
        pantMat.albedoColor = appearance.bottomColor;
        pantMat.roughness = 0.8;

        // Randomize shirt colors for variety
        const shirtColors = [
            new Color3(1, 0, 0),     // Red
            new Color3(0, 0, 1),     // Blue
            new Color3(0, 0.7, 0),   // Green
            new Color3(1, 0.5, 0),   // Orange
            new Color3(0.5, 0, 1),   // Purple
            new Color3(1, 1, 0),     // Yellow
            new Color3(1, 0, 1),     // Magenta
            new Color3(0.5, 0.5, 0.5) // Gray
        ];
        const selectedShirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
        topMat.albedoColor = selectedShirtColor;

        // Body Parts (Simplified "Humanoid" Assembly until GLTF is loaded)
        
        // Torso
        const torso = MeshBuilder.CreateBox('torso', { width: 0.4, height: 0.6, depth: 0.25 }, scene);
        torso.position.y = 1.1;
        torso.material = topMat;
        torso.parent = parent;
        shadowGenerator.addShadowCaster(torso);

        // Head
        const head = MeshBuilder.CreateSphere('head', { diameter: 0.25 }, scene);
        head.position.y = 1.6;
        head.material = skinMat;
        head.parent = parent;
        shadowGenerator.addShadowCaster(head);
        
        // Hair (Procedural Cap)
        const hair = MeshBuilder.CreateSphere('hair', { diameter: 0.26, slice: 0.5 }, scene);
        hair.position.y = 1.62;
        hair.rotation.x = Math.PI;
        const hairMat = new PBRMaterial('hairMat', scene);
        hairMat.albedoColor = new Color3(0.1, 0.1, 0.1);
        hair.material = hairMat;
        hair.parent = parent;

        // Legs (L/R)
        const legL = MeshBuilder.CreateBox('legL', { width: 0.15, height: 0.8, depth: 0.15 }, scene);
        legL.position = new Vector3(-0.12, 0.4, 0);
        legL.material = pantMat;
        legL.parent = parent;
        shadowGenerator.addShadowCaster(legL);

        const legR = MeshBuilder.CreateBox('legR', { width: 0.15, height: 0.8, depth: 0.15 }, scene);
        legR.position = new Vector3(0.12, 0.4, 0);
        legR.material = pantMat;
        legR.parent = parent;
        shadowGenerator.addShadowCaster(legR);
        
        // Arms
        const armL = MeshBuilder.CreateBox('armL', { width: 0.12, height: 0.6, depth: 0.12 }, scene);
        armL.position = new Vector3(-0.28, 1.1, 0);
        armL.material = skinMat; // Short sleeves
        armL.parent = parent;

        const armR = MeshBuilder.CreateBox('armR', { width: 0.12, height: 0.6, depth: 0.12 }, scene);
        armR.position = new Vector3(0.28, 1.1, 0);
        armR.material = skinMat;
        armR.parent = parent;

        // Store animation targets if needed
        return { torso, head, legL, legR, armL, armR };
    };
    createCharacterRef.current = createMidPolyCharacter;

    const avatarBody = MeshBuilder.CreateBox('avatarBody', { width: 0.8, height: 1.8, depth: 0.6 }, scene)
    avatarBody.position = new Vector3(carBody.position.x, 0.9, carBody.position.z - 3)
    avatarBody.checkCollisions = true
    avatarBody.isVisible = false // Parent invisible, children visible
    avatarMeshRef.current = avatarBody

    // Create character
    createMidPolyCharacter(avatarBody as Mesh, characterAppearance);

    // -- Properties / Locations System --
    // Add "Home" to locations
    const locationsWithHome = [
        ...TOWN_LOCATIONS.map(l => ({
            ...l,
            position: new Vector3(l.position_x, 0, l.position_z),
            metadata: l.metadata || {}
        })),
        { id: 'home', name: 'Home', description: 'Return to Dashboard', route: '/', position: new Vector3(40, 0, -40), path: '/', type: 'residential', position_x: 40, position_z: -40, metadata: {} }
    ];

    locationsWithHome.forEach((loc: any) => {

        // Procedural Building Generation based on Type
        let building: Mesh;
        let buildingMat: PBRMaterial;
        
        if (loc.type === 'church') {
             // Church Structure
             const mainHall = MeshBuilder.CreateBox(`${loc.id}_main`, { width: 14, height: 10, depth: 20 }, scene);
             mainHall.position = new Vector3(loc.position.x, 5, loc.position.z);
             
             const steeple = MeshBuilder.CreateCylinder(`${loc.id}_steeple`, { diameter: 4, height: 12, tessellation: 4 }, scene);
             steeple.position = new Vector3(loc.position.x, 16, loc.position.z - 8);
             steeple.rotation.y = Math.PI / 4;
             
             const spire = MeshBuilder.CreateCylinder(`${loc.id}_spire`, { diameterTop: 0, diameterBottom: 4, height: 8, tessellation: 4 }, scene);
             spire.position = new Vector3(loc.position.x, 24, loc.position.z - 8);
             spire.rotation.y = Math.PI / 4;

             // Merge meshes? For simplicity, parent them
             steeple.parent = mainHall;
             spire.parent = mainHall;
             
             building = mainHall;
             
             // Cross
             const vCross = MeshBuilder.CreateBox(`${loc.id}_crossV`, { width: 0.5, height: 4, depth: 0.5 }, scene);
             vCross.position = new Vector3(0, 28, -8);
             vCross.parent = mainHall; // Local pos? No, parented keeps world pos if set before. 
             // Re-set local pos
             vCross.position = new Vector3(0, 23, -8);
             
             const hCross = MeshBuilder.CreateBox(`${loc.id}_crossH`, { width: 2.5, height: 0.5, depth: 0.5 }, scene);
             hCross.position = new Vector3(0, 24, -8);
             hCross.parent = mainHall;

             buildingMat = new PBRMaterial(`${loc.id}_mat`, scene);
             buildingMat.albedoColor = new Color3(0.8, 0.75, 0.7); // Sandstone
             buildingMat.roughness = 0.9;
             
             // Stained Glass Windows (Emissive)
             const glassMat = new PBRMaterial(`${loc.id}_glass`, scene);
             glassMat.emissiveColor = new Color3(0.3, 0.3, 0.8);
             glassMat.albedoColor = new Color3(0, 0, 0);
             
             for(let i=-6; i<=6; i+=4) {
                 const winL = MeshBuilder.CreatePlane(`winL_${i}`, { width: 1.5, height: 4 }, scene);
                 winL.position = new Vector3(-7.1, 0, i);
                 winL.rotation.y = -Math.PI/2;
                 winL.parent = mainHall;
                 winL.material = glassMat;
                 
                 const winR = MeshBuilder.CreatePlane(`winR_${i}`, { width: 1.5, height: 4 }, scene);
                 winR.position = new Vector3(7.1, 0, i);
                 winR.rotation.y = Math.PI/2;
                 winR.parent = mainHall;
                 winR.material = glassMat;
             }

        } else if (loc.type === 'gas') {
             // Gas Station
             // Canopy
             const canopy = MeshBuilder.CreateBox(`${loc.id}_canopy`, { width: 16, height: 1, depth: 12 }, scene);
             canopy.position = new Vector3(loc.position.x, 6, loc.position.z);
             
             // Pillars
             const p1 = MeshBuilder.CreateBox(`${loc.id}_p1`, { width: 1, height: 6, depth: 1 }, scene);
             p1.position = new Vector3(-6, -3, 0);
             p1.parent = canopy;
             
             const p2 = MeshBuilder.CreateBox(`${loc.id}_p2`, { width: 1, height: 6, depth: 1 }, scene);
             p2.position = new Vector3(6, -3, 0);
             p2.parent = canopy;
             
             // Pumps
             const pumpMat = new PBRMaterial(`${loc.id}_pumpMat`, scene);
             pumpMat.albedoColor = new Color3(0.8, 0.1, 0.1);
             pumpMat.roughness = 0.4;
             
             const pump1 = MeshBuilder.CreateBox(`${loc.id}_pump1`, { width: 1.5, height: 2.5, depth: 1 }, scene);
             pump1.position = new Vector3(-3, -5, 0); // Relative to canopy Y=6 -> Y=1
             pump1.parent = canopy;
             pump1.material = pumpMat;
             
             const pump2 = MeshBuilder.CreateBox(`${loc.id}_pump2`, { width: 1.5, height: 2.5, depth: 1 }, scene);
             pump2.position = new Vector3(3, -5, 0);
             pump2.parent = canopy;
             pump2.material = pumpMat;
             
             building = canopy;
             buildingMat = new PBRMaterial(`${loc.id}_mat`, scene);
             buildingMat.albedoColor = new Color3(0.9, 0.9, 0.9);
             buildingMat.roughness = 0.5;

        } else if (loc.type === 'store' && loc.metadata) {
             // TrollMart / Trollgers
             const width = 20;
             const depth = 15;
             const height = 8;
             const colorHex = loc.metadata.color || '#888888';
             const color = Color3.FromHexString(colorHex);
             
             const mainBox = MeshBuilder.CreateBox(`${loc.id}_main`, { width, height, depth }, scene);
             mainBox.position = new Vector3(loc.position.x, height/2, loc.position.z);
             
             building = mainBox;
             buildingMat = new PBRMaterial(`${loc.id}_mat`, scene);
             buildingMat.albedoColor = color;
             buildingMat.roughness = 0.6;
             
             // Entrance Glass Doors
             const doorWidth = 3;
             const doorHeight = 4;
             const doorMat = new PBRMaterial(`${loc.id}_door_mat`, scene);
             doorMat.albedoColor = new Color3(0.1, 0.2, 0.3);
             doorMat.metallic = 0.9;
             doorMat.roughness = 0.1;
             
             // Left door
             const doorLeft = MeshBuilder.CreateBox(`${loc.id}_door_left`, { width: doorWidth, height: doorHeight, depth: 0.3 }, scene);
             doorLeft.position = new Vector3(-2, doorHeight/2, -depth/2 + 0.2);
             doorLeft.material = doorMat;
             doorLeft.parent = mainBox;
             
             // Right door
             const doorRight = MeshBuilder.CreateBox(`${loc.id}_door_right`, { width: doorWidth, height: doorHeight, depth: 0.3 }, scene);
             doorRight.position = new Vector3(2, doorHeight/2, -depth/2 + 0.2);
             doorRight.material = doorMat;
             doorRight.parent = mainBox;
             
             // Door frame/handle detail
             const handleMat = new PBRMaterial(`${loc.id}_handle_mat`, scene);
             handleMat.albedoColor = new Color3(0.8, 0.7, 0.5);
             handleMat.metallic = 0.95;
             handleMat.roughness = 0.2;
             
             const handle = MeshBuilder.CreateCylinder(`${loc.id}_handle`, { diameter: 0.15, height: 0.08 }, scene);
             handle.position = new Vector3(1.2, doorHeight/2, -depth/2 + 0.5);
             handle.rotation.z = Math.PI / 2;
             handle.material = handleMat;
             handle.parent = mainBox;

        } else {
            // Generic / Residential / Service
            const width = 10;
            const height = 8;
            const depth = 10;
            
            building = MeshBuilder.CreateBox(`location_${loc.id}`, { width, height, depth }, scene);
            building.position = new Vector3(loc.position.x, height/2, loc.position.z);
            buildingMat = new PBRMaterial(`locMat_${loc.id}`, scene);
            buildingMat.albedoColor = new Color3(0.3, 0.4, 0.5);
            buildingMat.roughness = 0.6;
            
            // Add residential door
            const doorWidth = 2;
            const doorHeight = 3.5;
            const doorMat = new PBRMaterial(`${loc.id}_door_mat`, scene);
            doorMat.albedoColor = new Color3(0.4, 0.25, 0.1); // Wooden door
            doorMat.roughness = 0.7;
            
            const door = MeshBuilder.CreateBox(`${loc.id}_door`, { width: doorWidth, height: doorHeight, depth: 0.2 }, scene);
            door.position = new Vector3(0, doorHeight/2, -depth/2 + 0.1);
            door.material = doorMat;
            door.parent = building;
            
            // Door knob
            const knobMat = new PBRMaterial(`${loc.id}_knob_mat`, scene);
            knobMat.albedoColor = new Color3(0.8, 0.7, 0.5);
            knobMat.metallic = 0.95;
            
            const knob = MeshBuilder.CreateSphere(`${loc.id}_knob`, { diameter: 0.15 }, scene);
            knob.position = new Vector3(0.7, doorHeight/2, -depth/2 + 0.3);
            knob.material = knobMat;
            knob.parent = building;
        }

        building.material = buildingMat;
        building.checkCollisions = true;
        buildings.push(building);
        shadowGenerator.addShadowCaster(building);
        
        // Add Collider for Interaction Radius (invisible sphere?)
        // Or just use distance check in render loop (existing system)

        // Banner / Sign
        const planeWidth = 8;
        const planeHeight = 2;
        const plane = MeshBuilder.CreatePlane(`banner_${loc.id}`, { width: planeWidth, height: planeHeight }, scene);
        // Adjust banner height based on building type
        const bannerY = loc.type === 'church' ? 12 : loc.type === 'gas' ? 7 : 9.5;
        plane.position = new Vector3(loc.position.x, bannerY, loc.position.z);
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;

        const dt = new DynamicTexture(`dt_${loc.id}`, { width: 512, height: 128 }, scene);
        dt.hasAlpha = true;
        
        // Draw text
        const ctx = dt.getContext() as CanvasRenderingContext2D;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, 512, 128);
        ctx.font = "bold 40px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(loc.name, 256, 64);
        dt.update();

        const planeMat = new PBRMaterial(`bannerMat_${loc.id}`, scene);
        planeMat.albedoTexture = dt;
        planeMat.emissiveColor = new Color3(1, 1, 1);
        planeMat.useAlphaFromAlbedoTexture = true;
        planeMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        plane.material = planeMat;
    });

    // Create random NPC characters around TrollsTown
    const createNPC = (name: string, position: Vector3, scale: number = 1) => {
        // Create NPC root
        const npcRoot = new TransformNode(`npc_${name}`, scene);
        npcRoot.position = position;
        
        // Body
        const bodyMat = new PBRMaterial(`${name}_body_mat`, scene);
        bodyMat.albedoColor = new Color3(Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2);
        bodyMat.roughness = 0.7;
        
        const body = MeshBuilder.CreateCapsule(`${name}_body`, { height: 1.8, radius: 0.3 }, scene);
        body.position.y = 0.9 * scale;
        body.material = bodyMat;
        body.parent = npcRoot;
        body.scaling = new Vector3(scale, scale, scale);
        
        // Head
        const headMat = new PBRMaterial(`${name}_head_mat`, scene);
        headMat.albedoColor = new Color3(0.9, 0.7, 0.6); // Skin tone
        headMat.roughness = 0.5;
        
        const head = MeshBuilder.CreateSphere(`${name}_head`, { diameter: 0.4 * scale }, scene);
        head.position.y = 1.6 * scale;
        head.material = headMat;
        head.parent = npcRoot;
        
        // Eyes
        const eyeMat = new PBRMaterial(`${name}_eye_mat`, scene);
        eyeMat.albedoColor = new Color3(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4);
        eyeMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
        
        const eyeL = MeshBuilder.CreateSphere(`${name}_eyeL`, { diameter: 0.08 * scale }, scene);
        eyeL.position = new Vector3(-0.08 * scale, 1.65 * scale, 0.18 * scale);
        eyeL.material = eyeMat;
        eyeL.parent = npcRoot;
        
        const eyeR = MeshBuilder.CreateSphere(`${name}_eyeR`, { diameter: 0.08 * scale }, scene);
        eyeR.position = new Vector3(0.08 * scale, 1.65 * scale, 0.18 * scale);
        eyeR.material = eyeMat;
        eyeR.parent = npcRoot;
        
        // Arms
        const armMat = new PBRMaterial(`${name}_arm_mat`, scene);
        armMat.albedoColor = bodyMat.albedoColor;
        armMat.roughness = 0.7;
        
        const armL = MeshBuilder.CreateCylinder(`${name}_armL`, { diameter: 0.15 * scale, height: 0.8 * scale }, scene);
        armL.position = new Vector3(-0.35 * scale, 1.3 * scale, 0);
        armL.rotation.z = 0.3;
        armL.material = armMat;
        armL.parent = npcRoot;
        
        const armR = MeshBuilder.CreateCylinder(`${name}_armR`, { diameter: 0.15 * scale, height: 0.8 * scale }, scene);
        armR.position = new Vector3(0.35 * scale, 1.3 * scale, 0);
        armR.rotation.z = -0.3;
        armR.material = armMat;
        armR.parent = npcRoot;
        
        // Legs
        const legMat = new PBRMaterial(`${name}_leg_mat`, scene);
        legMat.albedoColor = new Color3(0.2, 0.2, 0.2);
        legMat.roughness = 0.8;
        
        const legL = MeshBuilder.CreateCylinder(`${name}_legL`, { diameter: 0.15 * scale, height: 0.9 * scale }, scene);
        legL.position = new Vector3(-0.15 * scale, 0.45 * scale, 0);
        legL.material = legMat;
        legL.parent = npcRoot;
        
        const legR = MeshBuilder.CreateCylinder(`${name}_legR`, { diameter: 0.15 * scale, height: 0.9 * scale }, scene);
        legR.position = new Vector3(0.15 * scale, 0.45 * scale, 0);
        legR.material = legMat;
        legR.parent = npcRoot;
        
        return npcRoot;
    };

    // Spawn NPCs at various locations
    const npcSpawnPoints = [
        { name: 'troll_1', position: new Vector3(20, 0, 0) },
        { name: 'troll_2', position: new Vector3(-20, 0, -20) },
        { name: 'troll_3', position: new Vector3(30, 0, 30) },
        { name: 'troll_4', position: new Vector3(-30, 0, 20) },
        { name: 'troll_5', position: new Vector3(0, 0, 35) },
    ];

    npcSpawnPoints.forEach(({ name, position }) => {
        const npc = createNPC(name, position, 0.9);
        
        // Add simple walking animation
        const walkAnimation = new Animation(
            `${name}_walk`,
            'position.x',
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const keys = [
            { frame: 0, value: position.x },
            { frame: 30, value: position.x + 5 },
            { frame: 60, value: position.x }
        ];
        
        walkAnimation.setKeys(keys);
        npc.animations.push(walkAnimation);
        
        // Start animation with random delay
        scene.beginAnimation(npc, 0, 60, true, 1.5 + Math.random());
    });


    const houseTemplates: Record<string, Mesh> = {};
    Object.keys(houseMaterials).forEach(style => {
        const tmpl = MeshBuilder.CreateBox(`houseTemplate_${style}`, { width: 8, height: 4, depth: 8 }, scene);
        tmpl.material = houseMaterials[style];
        tmpl.isVisible = false;
        shadowGenerator.addShadowCaster(tmpl, true);
        houseTemplates[style] = tmpl;
    });

    const ghostTemplate = MeshBuilder.CreateBox('ghostCarTemplate', { width: 2, height: 1, depth: 4 }, scene)
    const ghostMaterial = new PBRMaterial('ghostMat', scene)
    ghostMaterial.albedoColor = new Color3(0.2, 0.8, 0.9)
    ghostMaterial.alpha = 0.3
    ghostMaterial.roughness = 0.5
    ghostTemplate.material = ghostMaterial
    ghostTemplate.position.y = 0.6
    ghostTemplate.isVisible = false // Hide the template
    ghostTemplate.setEnabled(false) // Disable it so it doesn't appear
    shadowGenerator.addShadowCaster(ghostTemplate);

    // -- Environment Enrichment --
    const createFoliage = () => {
        const trunkMat = new PBRMaterial('trunkMat', scene);
        trunkMat.albedoColor = new Color3(0.4, 0.3, 0.2);
        trunkMat.roughness = 0.92;  // Wood is very rough
        trunkMat.metallic = 0.0;
        trunkMat.ambientColor = new Color3(0.15, 0.1, 0.05);
        
        // Add normal map for bark detail
        const barkNormal = new Texture("https://assets.babylonjs.com/textures/rockn.png", scene);
        barkNormal.uScale = 4;
        barkNormal.vScale = 4;
        trunkMat.bumpTexture = barkNormal;
        
        // Translucency for leaves
        const leafMat = new PBRMaterial('leafMat', scene);
        leafMat.albedoColor = new Color3(0.1, 0.4, 0.1);
        leafMat.roughness = 0.7;  // Leaves have slight sheen
        leafMat.metallic = 0.0;
        leafMat.ambientColor = new Color3(0.05, 0.15, 0.05);
        
        // Enable subsurface scattering for light-through-leaves effect
        leafMat.subSurface.isRefractionEnabled = true;
        leafMat.subSurface.refractionIntensity = 0.3;
        leafMat.subSurface.translucencyIntensity = 0.2;
        
        // Create base tree meshes
        const trunk = MeshBuilder.CreateCylinder('treeTrunk', { diameter: 0.8, height: 4 }, scene);
        trunk.material = trunkMat;
        trunk.position.y = 2; // Center pivot

        const leaves = MeshBuilder.CreateSphere('treeLeaves', { diameter: 5, segments: 8 }, scene);
        leaves.position.y = 4; // Relative to ground if not parented yet
        leaves.material = leafMat;
        
        // Merge into one mesh for instancing
        const treeBase = Mesh.MergeMeshes([trunk, leaves], true, true, undefined, false, true);
        if (treeBase) {
            treeBase.name = "treeBase";
            treeBase.setEnabled(false); // Hide the template
            
            // Scatter trees along roads - COMPLETELY SKIP CENTER AREA
            for(let z = -190; z <= 190; z+=20) {
                if(Math.abs(z) < 120) continue; // Skip middle of street (was 100, now 120 for buffer)
                
                // Left side
                const t1 = treeBase.createInstance(`tree_L_${z}`);
                t1.position = new Vector3(-14, 0, z + Math.random() * 2); // Reduce random to 2 for tighter control
                t1.rotation.y = Math.random() * Math.PI;
                t1.scaling = new Vector3(0.8 + Math.random()*0.4, 0.8 + Math.random()*0.4, 0.8 + Math.random()*0.4);
                shadowGenerator.addShadowCaster(t1);
                
                // Right side
                const t2 = treeBase.createInstance(`tree_R_${z}`);
                t2.position = new Vector3(14, 0, z + Math.random() * 2); // Reduce random to 2 for tighter control
                t2.rotation.y = Math.random() * Math.PI;
                t2.scaling = new Vector3(0.8 + Math.random()*0.4, 0.8 + Math.random()*0.4, 0.8 + Math.random()*0.4);
                shadowGenerator.addShadowCaster(t2);
            }
        }
    }
    
    createFoliage();

    const createDistantCity = () => {
        // Simple distant skyscrapers
        const buildingMat = new PBRMaterial('distantBuildingMat', scene);
        buildingMat.albedoColor = new Color3(0.1, 0.1, 0.15);
        buildingMat.roughness = 0.5;
        buildingMat.emissiveColor = new Color3(0.05, 0.05, 0.1); // Slight night glow
        
        for(let i=0; i<20; i++) {
            const width = 20 + Math.random() * 30;
            const height = 100 + Math.random() * 200;
            const depth = 20 + Math.random() * 30;
            
            const b = MeshBuilder.CreateBox(`distant_b_${i}`, { width, height, depth }, scene);
            // Place far away
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 200;
            b.position = new Vector3(Math.cos(angle) * dist, height/2 - 20, Math.sin(angle) * dist);
            b.material = buildingMat;
        }
    }
    
    createDistantCity();

    const camera = new ArcRotateCamera('arcCam', -Math.PI / 2, Math.PI / 3, 20, carBody.position, scene)
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 40
    camera.upperBetaLimit = Math.PI / 2 - 0.1
    camera.attachControl(canvas, true)
    scene.activeCamera = camera

    // Post Processing (GTA Style with Advanced Effects)
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);
    pipeline.samples = 8;  // Increased MSAA for better edge quality
    pipeline.fxaaEnabled = true;
    
    // Enhanced Bloom for cinematic light bleeding
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.5;  // Lower threshold captures more highlights
    pipeline.bloomWeight = 0.6;  // Increased intensity
    pipeline.bloomKernel = 128;  // Larger kernel for softer bloom
    pipeline.bloomScale = 0.6;

    // Advanced Tone Mapping (ACES for cinematic look)
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = 1.4;  // Increased for brighter look
    pipeline.imageProcessing.contrast = 1.3;  // Higher contrast for drama
    // Note: saturation is not available on ImageProcessingPostProcess in this Babylon.js version

    // Professional Color Grading (Teal/Orange cinematic look)
    const curves = new ColorCurves();
    curves.globalHue = 180;  // Slight blue shift for cool tones
    curves.globalDensity = 0;
    curves.shadowsHue = 200;  // Strong teal in shadows
    curves.shadowsDensity = 30;
    curves.midtonesHue = 180;
    curves.midtonesDensity = 10;
    curves.highlightsHue = 20;  // Warm orange in highlights
    curves.highlightsDensity = 25;
    
    pipeline.imageProcessing.colorCurvesEnabled = true;
    pipeline.imageProcessing.colorCurves = curves;

    // Vignette (adds cinematic frame)
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.8;  // Increased darkness at edges
    pipeline.imageProcessing.vignetteColor = new Color4(0.1, 0.1, 0.15, 0);
    
    // Film Grain (adds texture for gritty look)
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 12;  // More pronounced grain
    pipeline.grain.animated = true;
    
    // Chromatic Aberration (camera lens effect)
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 15;  // Stronger effect
    pipeline.chromaticAberration.radialIntensity = 2.5;

    // Advanced Screen Space Ambient Occlusion (SSAO2) for realistic depth perception
    try {
        const ssaoRatio = engine.getRenderingCanvas()?.width! / engine.getRenderingCanvas()?.height! || 1.0;
        const ssao = new SSAO2RenderingPipeline(
            "ssao2",
            scene,
            { ssaoRatio: ssaoRatio, blurRatio: 1 }
        );
        
        // Configure SSAO parameters for cinematic look
        (ssao as any).radius = 25;  // Larger radius for broader occlusion
        (ssao as any).bias = 0.015;
        (ssao as any).intensity = 1.8;  // Moderate strength
        (ssao as any).maxZ = 250;  // Far plane for large outdoor scenes
        (ssao as any).minZAspect = 0.2;
        
        // Configure samples for quality
        ssao.samples = 8;  // 8 samples for quality
        
        console.log("SSAO2 rendering pipeline enabled for advanced ambient occlusion");
    } catch (err) {
        console.warn("SSAO2 not available or disabled, using standard ambient occlusion", err);
        // Fallback: Continue with existing pipeline
    }

    // Apply Graphics Quality Settings
    const applyGraphicsQuality = (quality: 'low' | 'medium' | 'high') => {
        switch (quality) {
            case 'low':
                // Performance mode: disable expensive effects
                pipeline.samples = 2;  // MSAA reduced
                pipeline.bloomEnabled = false;
                pipeline.grainEnabled = false;
                pipeline.chromaticAberrationEnabled = false;
                pipeline.imageProcessing.vignetteEnabled = false;
                shadowGenerator.getShadowMap()!.refreshRate = 2;  // Every other frame
                engine.setHardwareScalingLevel(2);  // Lower resolution rendering
                console.log("Graphics quality set to LOW for maximum performance");
                break;
                
            case 'medium':
                // Balanced mode
                pipeline.samples = 4;
                pipeline.bloomEnabled = true;
                pipeline.bloomThreshold = 0.6;
                pipeline.bloomWeight = 0.4;
                pipeline.grainEnabled = true;
                pipeline.grain.intensity = 6;
                pipeline.chromaticAberrationEnabled = false;
                pipeline.imageProcessing.vignetteEnabled = true;
                pipeline.imageProcessing.vignetteWeight = 1.2;
                shadowGenerator.getShadowMap()!.refreshRate = 1;  // Every frame
                engine.setHardwareScalingLevel(1);
                console.log("Graphics quality set to MEDIUM for balanced performance");
                break;
                
            case 'high':
                // Ultra quality mode: all effects enabled
                pipeline.samples = 8;
                pipeline.bloomEnabled = true;
                pipeline.bloomThreshold = 0.5;
                pipeline.bloomWeight = 0.6;
                pipeline.grainEnabled = true;
                pipeline.grain.intensity = 12;
                pipeline.chromaticAberrationEnabled = true;
                pipeline.imageProcessing.vignetteEnabled = true;
                pipeline.imageProcessing.vignetteWeight = 1.8;
                shadowGenerator.getShadowMap()!.refreshRate = 1;
                engine.setHardwareScalingLevel(1);
                // Ensure textures are loaded at full quality
                scene.environmentIntensity = 1.2;
                console.log("Graphics quality set to HIGH for maximum visual fidelity");
                break;
        }
    };

    // Apply initial graphics quality
    applyGraphicsQuality(settings.graphicsQuality);

    // -- Vehicle Interaction System --
    // activeVehicleRef and isTransitioningRef moved to top level


    // Animation helper
    const animateDoor = (vehicleRoot: Mesh, isOpen: boolean) => {
        const doorL = (vehicleRoot as any).doorL as Mesh;
        if (doorL) {
            // Animate rotationY: 0 (closed) -> -PI/3 (open)
            const target = isOpen ? -Math.PI / 3 : 0;
            // Simple interpolation in render loop or Animation object. Let's use Animation.
            // But for simplicity in this context, let's just snap or use a simple tween in update loop.
            // Using Babylon Animation:
            const anim = new Animation("doorAnim", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
            anim.setKeys([{ frame: 0, value: doorL.rotation.y }, { frame: 30, value: target }]);
            scene.beginDirectAnimation(doorL, [anim], 0, 30, false);
        }
    };

    const handleInteract = () => {
        if (isTransitioningRef.current) return;
        
        const avatarPos = avatarBody.position;
        
        // 1. If in car, exit
        if (isInCarRef.current) {
            isTransitioningRef.current = true;
            const currentCarRoot = activeVehicleRef.current === 'playerCar' ? carBody : parkedCarMeshesRef.current.get(activeVehicleRef.current!)?.root;
            
            if (currentCarRoot) {
                animateDoor(currentCarRoot as Mesh, true); // Open
                
                setTimeout(() => {
                    // Teleport avatar out
                    avatarBody.position = currentCarRoot.position.clone().add(new Vector3(-2.5, 0, 0));
                    avatarBody.isVisible = true;
                    avatarBody.checkCollisions = true;
                    isInCarRef.current = false;
                    setIsInCar(false);
                    scene.activeCamera = camera; // Switch back to arc camera (or chase avatar?)
                    // Reset camera target to avatar
                    (camera as ArcRotateCamera).setTarget(avatarBody);
                    
                    animateDoor(currentCarRoot as Mesh, false); // Close
                    isTransitioningRef.current = false;
                    activeVehicleRef.current = null;
                }, 600);
            }
            return;
        }

        // 2. If walking, check nearby cars
        let closestDist = 3.5;
        let targetCarId: string | null = null;
        let targetCarRoot: Mesh | null = null;

        // Check player car
        if (Vector3.Distance(avatarPos, carBody.position) < closestDist) {
            targetCarId = 'playerCar';
            targetCarRoot = carBody as Mesh;
        }

        // Check parked cars
        parkedCarMeshesRef.current.forEach((val, id) => {
            const dist = Vector3.Distance(avatarPos, val.root.position);
            if (dist < closestDist) {
                closestDist = dist;
                targetCarId = id;
                targetCarRoot = val.root;
            }
        });

        if (targetCarId && targetCarRoot) {
            isTransitioningRef.current = true;
            animateDoor(targetCarRoot, true); // Open

            setTimeout(() => {
                avatarBody.isVisible = false;
                avatarBody.checkCollisions = false;
                isInCarRef.current = true;
                setIsInCar(true);
                activeVehicleRef.current = targetCarId;
                
                // Update camera
                (camera as ArcRotateCamera).setTarget(targetCarRoot!);
                
                animateDoor(targetCarRoot!, false); // Close
                isTransitioningRef.current = false;
            }, 600);
        }
    };

    // Keyboard listener for 'E' is handled in the game loop now via handleInteract()


    const collidables: Mesh[] = [ground as Mesh, roadMain as Mesh, roadCross as Mesh, ...(buildings as Mesh[])]
    collidables.forEach(m => {
      m.checkCollisions = true
    })

    carMeshRef.current = carBody
    avatarMeshRef.current = avatarBody
    isInCarRef.current = true
    lastFrameTimeRef.current = performance.now()

    const applyHousesToScene = async (houseRows: TownHouse[]) => {
      housesRef.current = houseRows
      setHouses(houseRows)
      ghostMeshesRef.current.forEach(mesh => {
        mesh.dispose()
      })
      ghostMeshesRef.current.clear()

      // Dispose old house instances and related objects
      scene.meshes.filter(m => 
        m.name.startsWith('houseInstance_') || 
        m.name.startsWith('win_') || 
        m.name.startsWith('roof_') || 
        m.name.startsWith('salePost_') || 
        m.name.startsWith('saleBoard_') ||
        m.name.startsWith('beacon_') ||
        m.name.startsWith('houseModel_')
      ).forEach(m => m.dispose());

      const allCollidables: Mesh[] = [...collidables]

      // We need to process houses. Some might use models, some procedural.
      // We can't easily async await inside forEach.
      // Let's use a for...of loop
      
      for (const h of houseRows) {
        let styleKey = h.parcel_building_style || h.metadata?.visual_tier || 'starter'
        // ... (profile unused)
        if (h.is_own) styleKey = 'owned';
        if (!houseTemplates[styleKey]) styleKey = 'starter';

        // Ensure houses are not in the street
        let safeX = h.position_x
        let safeZ = h.position_z

        // Main Road (Z-axis, width 12 -> +/- 6)
        if (Math.abs(safeX) < 15) {
             safeX = safeX >= 0 ? 20 : -20
        }
        // Cross Road (X-axis, width 12 -> +/- 6)
        if (Math.abs(safeZ) < 15) {
             safeZ = safeZ >= 0 ? 20 : -20
        }

        // Try to load a model if it exists in our map (hypothetically)
        // Or if we have a generic model for this tier
        // For now, we fallback to procedural immediately as we don't have the assets.
        // But to support "High-Poly Assets", we would do:
        /*
        try {
             const result = await SceneLoader.ImportMeshAsync("", "models/houses/", `${styleKey}.glb`, scene);
             const root = result.meshes[0];
             root.name = `houseModel_${h.id}`;
             root.position = new Vector3(safeX, 0, safeZ);
             allCollidables.push(root as Mesh);
             continue; // Skip procedural
        } catch {}
        */

        const tmpl = houseTemplates[styleKey];
        const instance = tmpl.createInstance(`houseInstance_${h.id}`);
        
        const baseHeight = 4
        let scaleY = 1
        let scaleXZ = 1
        
        if (styleKey === 'apartment') {
          scaleY = 3.5
          scaleXZ = 1.1
        } else if (styleKey === 'mega') {
          scaleY = 2.5
          scaleXZ = 1.8
        } else if (styleKey === 'mansion') {
          scaleY = 1.8
          scaleXZ = 1.6
        } else if (styleKey === 'luxury') {
          scaleY = 1.4
          scaleXZ = 1.4
        } else if (styleKey === 'mid') {
          scaleY = 1.2
          scaleXZ = 1.2
        }
        
        instance.scaling = new Vector3(scaleXZ, scaleY, scaleXZ)
        instance.position = new Vector3(safeX, (baseHeight * scaleY) / 2, safeZ)
        instance.checkCollisions = true
        allCollidables.push(instance as unknown as Mesh)

        const windowRows = styleKey === 'apartment' ? 5 : styleKey === 'mega' || styleKey === 'mansion' ? 4 : 2
        const windowCols = styleKey === 'apartment' ? 4 : 2
        const floorHeight = (baseHeight * scaleY) / windowRows
        const baseY = instance.position.y - (baseHeight * scaleY) / 2 + floorHeight * 0.8

        if (windowTemplate) {
          for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
              const offsetX = ((col / (windowCols - 1 || 1)) - 0.5) * (scaleXZ * 6)
              const y = baseY + row * floorHeight

              const front = windowTemplate.clone(`win_front_${h.id}_${row}_${col}`)
              front.isVisible = true
              front.position = new Vector3(instance.position.x + offsetX, y, instance.position.z + scaleXZ * 4.1)

              const back = windowTemplate.clone(`win_back_${h.id}_${row}_${col}`)
              back.isVisible = true
              back.position = new Vector3(instance.position.x + offsetX, y, instance.position.z - scaleXZ * 4.1)

              const left = windowTemplate.clone(`win_left_${h.id}_${row}_${col}`)
              left.isVisible = true
              left.rotation.y = Math.PI / 2
              left.position = new Vector3(instance.position.x - scaleXZ * 4.1, y, instance.position.z + offsetX)

              const right = windowTemplate.clone(`win_right_${h.id}_${row}_${col}`)
              right.isVisible = true
              right.rotation.y = Math.PI / 2
              right.position = new Vector3(instance.position.x + scaleXZ * 4.1, y, instance.position.z + offsetX)
            }
          }
        }

        const roof = MeshBuilder.CreateBox(`roof_${h.id}`, { width: scaleXZ * 8.5, height: 0.6, depth: scaleXZ * 8.5 }, scene)
        roof.position = new Vector3(instance.position.x, instance.position.y + baseHeight * scaleY * 0.55, instance.position.z)
        const roofMat = new PBRMaterial(`roofMat_${h.id}`, scene)
        roofMat.albedoColor = new Color3(0.35, 0.15, 0.1)
        roofMat.roughness = 0.8
        roof.material = roofMat
        shadowGenerator.addShadowCaster(roof)

        const isForSale = !!(h.metadata && (h.metadata.is_listed || h.metadata.ask_price))
        if (isForSale) {
          const signPost = MeshBuilder.CreateBox(`salePost_${h.id}`, { width: 0.15, height: 1.8, depth: 0.15 }, scene)
          signPost.position = new Vector3(safeX + scaleXZ * 5, 0.9, safeZ + scaleXZ * 3)
          const postMat = new PBRMaterial(`salePostMat_${h.id}`, scene)
          postMat.albedoColor = new Color3(1, 1, 1)
          signPost.material = postMat
          shadowGenerator.addShadowCaster(signPost)

          const signBoard = MeshBuilder.CreateBox(`saleBoard_${h.id}`, { width: 1.4, height: 0.8, depth: 0.1 }, scene)
          signBoard.position = new Vector3(signPost.position.x, signPost.position.y + 0.9, signPost.position.z)
          const signMat = new PBRMaterial(`saleBoardMat_${h.id}`, scene)
          signMat.albedoColor = new Color3(0.8, 0.1, 0.1)
          signMat.emissiveColor = new Color3(0.9, 0.2, 0.2)
          signBoard.material = signMat
          shadowGenerator.addShadowCaster(signBoard)
        }
        
        if (h.is_own) {
          const beacon = MeshBuilder.CreateCylinder(`beacon_${h.id}`, { diameterTop: 0.5, diameterBottom: 0.5, height: 100 }, scene)
          beacon.position = new Vector3(safeX, 50, safeZ)
          const beaconMat = new PBRMaterial('beaconMat', scene)
          beaconMat.emissiveColor = new Color3(0, 1, 0.5)
          beaconMat.alpha = 0.3
          beacon.material = beaconMat
        }
      }

      allCollidables.forEach(m => {
        m.checkCollisions = true
      })
    }

    const loadHouses = async () => {
      setLoadingHouses(true)
      try {
        const { data, error } = await supabase.rpc('get_town_houses')
        if (error) {
          throw error
        }
        if (Array.isArray(data)) {
          // Merge real data with our extra procedural houses
          const realHouses: TownHouse[] = data.map((row: any) => ({
            id: row.id,
            owner_user_id: row.owner_user_id,
            parcel_id: row.parcel_id,
            position_x: Number(row.position_x ?? 0),
            position_z: Number(row.position_z ?? 0),
            metadata: row.metadata || {},
            parcel_center_x: Number(row.parcel_center_x ?? 0),
            parcel_center_z: Number(row.parcel_center_z ?? 0),
            parcel_size_x: Number(row.parcel_size_x ?? 12),
            parcel_size_z: Number(row.parcel_size_z ?? 12),
            parcel_building_style: row.parcel_building_style ?? null,
            owner_username: row.owner_username ?? null,
            is_own: Boolean(row.is_own),
            last_raid_at: row.last_raid_at ?? null,
            last_raid_outcome: row.last_raid_outcome ?? null
          }))

          // Filter out extraHouses that overlap with real houses
          const finalHouses = [...realHouses];
          extraHouses.forEach(extra => {
             const overlap = realHouses.some(real => Math.abs(real.position_x - extra.position_x) < 5 && Math.abs(real.position_z - extra.position_z) < 5);
             if (!overlap) {
                 finalHouses.push(extra);
             }
          });

          applyHousesToScene(finalHouses)
        }
      } catch {
        toast.error('Failed to load houses')
      } finally {
        setLoadingHouses(false)
      }
    }

    const refreshMultiplayerGhosts = async () => {
      if (!user) return
      if (!scene) return
      setLoadingMultiplayer(true)
      try {
        const { data, error } = await supabase
          .from('town_player_state')
          .select('user_id, position_x, position_z, rotation_y, vehicle, updated_at')
          .neq('user_id', user.id)
        if (error) {
          throw error
        }
        const rows: PlayerStateRow[] = (data || []).map(row => ({
          user_id: row.user_id,
          position_x: Number(row.position_x ?? 0),
          position_z: Number(row.position_z ?? 0),
          rotation_y: Number(row.rotation_y ?? 0),
          vehicle: row.vehicle ?? null
        }))

        const existing = ghostMeshesRef.current
        const seenUserIds = new Set<string>()

        rows.forEach(row => {
          seenUserIds.add(row.user_id)
          let mesh = existing.get(row.user_id)
          if (!mesh) {
            mesh = ghostTemplate.createInstance(`ghost_${row.user_id}`) as unknown as Mesh
            existing.set(row.user_id, mesh)
          }
          mesh.position = new Vector3(row.position_x, ghostTemplate.position.y, row.position_z)
          mesh.rotation.y = row.rotation_y
        })

        existing.forEach((mesh, userId) => {
          if (!seenUserIds.has(userId)) {
            mesh.dispose()
            existing.delete(userId)
          }
        })
      } catch (err) {
        setLoadingMultiplayer(false)
        return
      }
      setLoadingMultiplayer(false)
    }

    loadHouses()
    const multiplayerInterval = window.setInterval(() => {
      refreshMultiplayerGhosts()
    }, 2000)

    const handleKeyDown = (event: KeyboardEvent) => {
      const gameKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ']
      if (gameKeys.includes(event.code)) {
        event.preventDefault()
      }
      
      if (event.code === 'KeyW' || event.code === 'ArrowUp') inputRef.current.forward = 1
      if (event.code === 'KeyS' || event.code === 'ArrowDown') inputRef.current.forward = -1
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') inputRef.current.steer = -1
      if (event.code === 'KeyD' || event.code === 'ArrowRight') inputRef.current.steer = 1
      if (event.code === 'Space') inputRef.current.brake = true
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') inputRef.current.boost = true
      if (event.code === 'KeyE') inputRef.current.interact = true
      if (event.code === 'KeyQ' || event.code === 'Escape') {
          inputRef.current.cancel = true
          if (event.code === 'Escape') setShowSettings(prev => !prev)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if ((event.code === 'KeyW' || event.code === 'ArrowUp') && inputRef.current.forward > 0) inputRef.current.forward = 0
      if ((event.code === 'KeyS' || event.code === 'ArrowDown') && inputRef.current.forward < 0) inputRef.current.forward = 0
      if ((event.code === 'KeyA' || event.code === 'ArrowLeft') && inputRef.current.steer < 0) inputRef.current.steer = 0
      if ((event.code === 'KeyD' || event.code === 'ArrowRight') && inputRef.current.steer > 0) inputRef.current.steer = 0
      if (event.code === 'Space') inputRef.current.brake = false
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') inputRef.current.boost = false
      if (event.code === 'KeyE') inputRef.current.interact = false
      if (event.code === 'KeyQ' || event.code === 'Escape') inputRef.current.cancel = false
    }

    // Register key listeners with capture phase for maximum responsiveness
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    let velocity = 0
    let heading = 0
    let avatarHeading = 0
    const maxSpeed = 40
    const acceleration = 18
    const brakeForce = 40
    const friction = 6
    const boostFactor = 1.6
    const turnRate = 1.6
    const onFootSpeed = 10
    const onFootTurnRate = 2.4

    const updateFromGamepad = () => {
      // Use Babylon Gamepad Manager if available
      const gm = gamepadManagerRef.current;
      if (!gm || gm.gamepads.length === 0) return;
      
      const pad = gm.gamepads[0]; // Primary controller
      
      if (pad instanceof Xbox360Pad) {
          // Xbox Mappings
          // RT (Button 7 usually, or property) -> Accelerate
          // LT -> Brake/Reverse
          // Left Stick -> Steer
          
          // Babylon Xbox360Pad has specific properties: buttonA, buttonB, etc.
          // And triggers are often on axes or buttons.
          // Let's use the generic properties if possible or mapped ones.
          
          const triggerRight = pad.rightTrigger;
          const triggerLeft = pad.leftTrigger;
          const stickLeftX = pad.leftStick.x;
          
          // Apply Deadzone
          const deadzone = settings.gamepadDeadzone;
          const steer = Math.abs(stickLeftX) > deadzone ? stickLeftX : 0;
          
          // Accelerate/Brake Logic
          if (triggerRight > 0.05) {
              inputRef.current.forward = triggerRight;
          } else if (triggerLeft > 0.05) {
              inputRef.current.forward = -triggerLeft;
          } else {
              // Only reset if keyboard isn't pressing (Dual Input)
              // We need to check if keyboard is active?
              // Ideally, we sum them or take max.
              // For now, let's say gamepad overrides if non-zero.
              // Or we can rely on `handleKeyDown` setting it, and we only overwrite if gamepad has input.
              // But handleKeyDown sets it to 1 or -1.
              // If we want dual input, we should separate them.
              // Let's just override for now as requested "priority: gamepad".
               if (inputRef.current.forward === 0) {
                   // Keep 0
               }
          }
          
          if (triggerRight > 0.05 || triggerLeft > 0.05) {
             // Gamepad is active on throttle
          }

          if (Math.abs(steer) > 0) {
              inputRef.current.steer = steer;
          }
          
          // Buttons
          // A (0) -> Interact (E)
          if (pad.buttonA) inputRef.current.interact = true;
          // B (1) -> Handbrake (Space)
          if (pad.buttonB) inputRef.current.brake = true;
          // X (2) -> Boost (Shift)
          if (pad.buttonX) inputRef.current.boost = true;
          // Y (3) -> Horn?
          
          // D-Pad for extras
      } else if (pad instanceof GenericPad) {
           // Fallback
           const browserPad = pad.browserGamepad
           const lx = browserPad.axes[0] || 0
           const rt = browserPad.buttons[7]?.value ?? 0
           const lt = browserPad.buttons[6]?.value ?? 0
           
           if (rt > 0.1) inputRef.current.forward = rt
           else if (lt > 0.1) inputRef.current.forward = -lt
           
           if (Math.abs(lx) > 0.15) inputRef.current.steer = lx
      }
    }

    let dayNightTime = 0

    const step = () => {
      const now = performance.now()
      const last = lastFrameTimeRef.current || now
      const dt = Math.min((now - last) / 1000, 0.05)
      lastFrameTimeRef.current = now

      dayNightTime += dt * 0.05
      const cycle = (Math.sin(dayNightTime) + 1) / 2
      light.intensity = 0.5 + cycle * 0.7
      light.groundColor = new Color3(0.01 + cycle * 0.05, 0.01 + cycle * 0.05, 0.03 + cycle * 0.12)
      groundMaterial.albedoColor = new Color3(
        0.02 + cycle * 0.05,
        0.08 + cycle * 0.15,
        0.02 + cycle * 0.05
      )

      updateFromGamepad()

      const car = carMeshRef.current
      const avatar = avatarMeshRef.current
      const isInCarNow = isInCarRef.current
      const activeVehicleId = activeVehicleRef.current;
      const currentVehicleRoot = activeVehicleId === 'playerCar' ? car : (activeVehicleId ? parkedCarMeshesRef.current.get(activeVehicleId)?.root : null);

      let activePosition: Vector3 | null = null
      let headingForState = 0

      if (isInCarNow && currentVehicleRoot) {
        const forwardInput = inputRef.current.forward
        const steerInput = inputRef.current.steer
        const isBraking = inputRef.current.brake
        const isBoosting = inputRef.current.boost

        // -- Improved Physics (Drift & Inertia) --
        // Drift Factor: 0 = rails, 1 = ice.
        // At high speeds, drift increases.
        // We track 'velocityVector' instead of just 'heading' + 'speed'.
        // But to keep it compatible with existing loop, we simulate drift by decoupling 'movement heading' from 'car heading'.
        
        // Actually, we can just modify 'heading' (visual/car) vs 'course' (movement).
        // Let's use a simple slip implementation.
        
        let driftAmount = 0;
        if (inputRef.current.brake && Math.abs(velocity) > 15 && Math.abs(steerInput) > 0) {
             // Handbrake drift
             driftAmount = 0.8; 
        } else if (Math.abs(velocity) > 30) {
             // High speed natural slip
             driftAmount = 0.2;
        }
        
        // Car Rotation (Steering)
        if (Math.abs(velocity) > 0.1) {
             // Reverse steering if going backwards
             const steerDir = velocity > 0 ? 1 : -1;
             const turnAmount = steerInput * steerDir * turnRate * dt * (Math.min(Math.abs(velocity) / maxSpeed, 1) + 0.2);
             heading += turnAmount;
        }
        
        // -- Wheel Animation (Steering & Rolling) --
        // 1. Steering (Front Wheels)
        // Access wheels via custom props we added
        const frontWheels = (currentVehicleRoot as any).frontWheels as Mesh[];
        const rearWheels = (currentVehicleRoot as any).rearWheels as Mesh[];
        const allWheels = (currentVehicleRoot as any).allWheels as { mesh: Mesh, rim: Mesh }[];
        
        if (frontWheels) {
            const targetSteer = steerInput * 0.6; // Max 35 degrees
            frontWheels.forEach(w => {
                // Smoothly interpolate steering angle
                w.rotation.y = Scalar.Lerp(w.rotation.y, targetSteer, 0.2);
            });
        }
        
        // 2. Rolling (All Wheels)
        // Rotate meshes inside pivot around local X (since they are rotated Z=90, rolling axis is X relative to pivot? No, geometry is cylinder Z-up. Rotated Z=90 puts top to +X. Rolling axis is local Y?)
        // Let's check geometry: Cylinder default is Y-up. rotation.z=PI/2 makes it X-up.
        // Rolling direction is Z (forward). So we rotate around X axis?
        // Actually, if we rotate the mesh itself, it spins.
        // Rotation axis depends on how it was built.
        // Cylinder Y-up. Rot Z=90 -> X-up. Wheel faces X. Rolls along Z. Rotation axis is X.
        
        if (allWheels && Math.abs(velocity) > 0.01) {
            const rollAmount = -velocity * dt / 0.35; // velocity / radius
            allWheels.forEach(w => {
                // w.mesh is the wheel cylinder.
                // It is child of pivot.
                // Pivot rotates Y for steering.
                // Mesh should rotate X for rolling.
                w.mesh.rotation.x += rollAmount;
                w.rim.rotation.x += rollAmount;
            });
        }

        // Physics Vector Calculation
        // Currently: dir = (sin(heading), 0, cos(heading))
        // With drift: We want the car to slide.
        // We need to maintain a 'momentum' vector?
        // Since we only have 'velocity' scalar and 'heading', this is hard.
        // Let's stick to the existing scalar velocity but add visual tilt.
        
        // Visual Body Roll (Suspension)
        // Roll (Z rotation) based on steering * speed
        // Pitch (X rotation) based on acceleration/braking
        
        const roll = -steerInput * (Math.abs(velocity) / maxSpeed) * 0.15;
        const pitch = (forwardInput * 0.05) - (isBraking ? 0.08 : 0);
        
        // Apply to a child mesh? 'currentVehicleRoot' is the parent.
        // If we rotate parent X/Z, it might clip ground.
        // Ideally we rotate the 'chassis' child.
        // Let's try to find the chassis.
        const chassisMesh = currentVehicleRoot.getChildren().find(m => m.name.includes('chassis')) as Mesh;
        if (chassisMesh) {
             // Damping for smoothness
             chassisMesh.rotation.z = Scalar.Lerp(chassisMesh.rotation.z, roll, 0.1);
             chassisMesh.rotation.x = Scalar.Lerp(chassisMesh.rotation.x, pitch, 0.1);
        }

        // Improved arcade physics: "S" brakes hard if moving forward, then reverses
        if (forwardInput !== 0) {
           if ((forwardInput > 0 && velocity < -0.5) || (forwardInput < 0 && velocity > 0.5)) {
             // Counter-force (braking)
             const brakeDir = velocity > 0 ? -1 : 1
             velocity += brakeDir * brakeForce * dt
           } else {
             // Normal acceleration
             const accel = acceleration * (isBoosting ? boostFactor : 1)
             velocity += forwardInput * accel * dt
           }
        }

        const frictionForce = friction * dt
        if (forwardInput === 0) {
            // Apply friction only when no input
            if (Math.abs(velocity) < frictionForce) {
              velocity = 0
            } else {
              velocity -= Math.sign(velocity) * frictionForce
            }
        }

        if (isBraking && Math.abs(velocity) > 0) {
          const brakeStep = brakeForce * dt * (inputRef.current.steer ? 0.5 : 1) // Less braking if drifting
          if (Math.abs(velocity) <= brakeStep) {
            velocity = 0
          } else {
            velocity -= Math.sign(velocity) * brakeStep
          }
        }

        const speedLimit = maxSpeed * (isBoosting ? boostFactor : 1)
        if (velocity > speedLimit) velocity = speedLimit
        if (velocity < -speedLimit * 0.5) velocity = -speedLimit * 0.5

        const prevPosition = currentVehicleRoot.position.clone()
        const dir = new Vector3(Math.sin(heading), 0, Math.cos(heading))
        currentVehicleRoot.rotation.y = heading
        currentVehicleRoot.position = currentVehicleRoot.position.add(dir.scale(velocity * dt))

        let collided = false
        for (const m of buildings) {
          if (currentVehicleRoot.intersectsMesh(m, true)) { // Precise collision
            collided = true
            break
          }
        }
        if (collided) {
          currentVehicleRoot.position.copyFrom(prevPosition)
          velocity *= -0.5 // Bounce
        }

        activePosition = currentVehicleRoot.position
        headingForState = heading
      } else if (!isInCarNow && avatar) {
        const forwardInput = inputRef.current.forward
        const steerInput = inputRef.current.steer

        avatarHeading += steerInput * onFootTurnRate * dt

        const dir = new Vector3(Math.sin(avatarHeading), 0, Math.cos(avatarHeading))
        avatar.rotation.y = avatarHeading
        
        // Improved Movement with Collision Sliding
        const moveVector = dir.scale(forwardInput * onFootSpeed * dt);
        moveVector.y = -9.81 * dt; // Simple gravity to keep grounded
        
        // Ensure ellipsoid is set for collision
        if (!avatar.ellipsoid) {
            avatar.ellipsoid = new Vector3(0.4, 0.9, 0.4);
            avatar.ellipsoidOffset = new Vector3(0, 0.9, 0);
        }
        
        // Try movement with collision response
        const newPos = avatar.position.add(moveVector);
        let collided = false;
        
        // Check all buildings for collision
        for (const m of buildings) {
          // Create bounding box check
          if (avatar.getAbsolutePosition().subtract(m.getAbsolutePosition()).length() < 3) {
            // Close enough to check precise collision
            if (avatar.intersectsMesh(m, false)) {
              collided = true;
              break;
            }
          }
        }
        
        if (!collided) {
          avatar.position = newPos;
        } else {
          // Try sliding along the collision surface
          const slideX = new Vector3(dir.x, 0, 0).scale(forwardInput * onFootSpeed * dt * 0.7);
          const slideZ = new Vector3(0, 0, dir.z).scale(forwardInput * onFootSpeed * dt * 0.7);
          
          let canSlideX = true;
          let canSlideZ = true;
          
          for (const m of buildings) {
            const testPosX = avatar.position.add(slideX);
            const testPosZ = avatar.position.add(slideZ);
            
            if (testPosX.subtract(m.getAbsolutePosition()).length() < 2) {
              if (avatar.position.add(slideX).subtract(m.position).length() < avatar.ellipsoid.x + 0.5) {
                canSlideX = false;
              }
            }
            if (testPosZ.subtract(m.getAbsolutePosition()).length() < 2) {
              if (avatar.position.add(slideZ).subtract(m.position).length() < avatar.ellipsoid.x + 0.5) {
                canSlideZ = false;
              }
            }
          }
          
          if (canSlideX) avatar.position.addInPlace(slideX);
          if (canSlideZ) avatar.position.addInPlace(slideZ);
        }
        
        // Safety floor clamp
        if (avatar.position.y < 0.9) avatar.position.y = 0.9;

        activePosition = avatar.position
        headingForState = avatarHeading
      }

      if (camera.target !== (isInCarNow ? car : avatar) && (car || avatar)) {
        // camera.target = (isInCarNow ? car : avatar)!.position
        // ArcRotateCamera target is a Vector3, not a mesh (unless setTarget is used, but direct property is Vector3)
        // Actually, we can just update the position every frame
      }
      
      // Update camera target to follow smoothly
      const targetMesh = isInCarNow ? car : avatar
      if (targetMesh) {
          // -- GTA Style Camera Logic --
          // Instead of simple Lerp, we want the camera to lag behind the rotation of the car.
          // ArcRotateCamera automatically orbits, but we want to control the 'alpha' (rotation around Y) based on car's heading.
          
          if (isInCarNow) {
              // Calculate desired alpha (behind the car)
              // Car heading is 'headingForState'.
              // Camera alpha 0 is usually +X? -Z?
              // In Babylon, alpha rotates around Y. 0 = +X, PI/2 = +Z, PI = -X, 3PI/2 = -Z.
              // Our car moves: dir = (sin(heading), 0, cos(heading)).
              // Heading 0 -> +Z (North).
              // So car 0 deg = +Z.
              // Camera behind car means Camera should be at -Z (alpha = 3PI/2 or -PI/2).
              // So Desired Alpha = Heading - PI/2?
              // Let's test: Heading 0 (North). Back is South. Camera should be at South.
              // South is -Z. Alpha for -Z is 3PI/2 (270 deg) or -PI/2 (-90 deg).
              // So: TargetAlpha = Heading - Math.PI / 2.
              
              const targetAlpha = -(headingForState + Math.PI / 2);
              
              // Smoothly interpolate current alpha to target alpha
              // We need to handle the wrap-around (0 <-> 2PI)
              
              // Simplification: Just set it with a low beta (height) and let user rotate if they want?
              // GTA camera snaps back when driving fast.
              
              if (Math.abs(velocity) > 5) {
                  // Only auto-rotate if moving
                  // camera.alpha = Scalar.Lerp(camera.alpha, targetAlpha, 0.05); // Lerp is tricky with angles
                  
                  // Use simple damping
                  const diff = targetAlpha - camera.alpha;
                  // Normalize diff to -PI to PI
                  const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
                  
                  camera.alpha += normalizedDiff * 0.02; // Slow follow
              }
              
              // Pitch (Beta) - dynamic based on speed?
              // camera.beta = Math.PI / 3 - (Math.abs(velocity) / maxSpeed) * 0.1;
          }

          // Smoothly interpolate camera target position
          const currentTarget = camera.target
          const desiredTarget = targetMesh.position.clone()
          
          // If we want to look slightly above the car/avatar
          desiredTarget.y += 1.5

          // Use a simple lerp for smoothness
          camera.target = Vector3.Lerp(currentTarget, desiredTarget, 0.1)
      }


      // Fuel Consumption Logic
      if (isInCarNow && Math.abs(velocity) > 0.1 && fuelRef.current > 0) {
          // Consume fuel based on speed
          const consumptionRate = 0.05 * dt * (Math.abs(velocity) / maxSpeed);
          fuelRef.current = Math.max(0, fuelRef.current - consumptionRate);
          // Only update state if significantly different to save renders
          if (Math.floor(fuelRef.current) !== Math.floor(lastReportedFuelRef.current)) {
             setFuel(fuelRef.current);
             lastReportedFuelRef.current = fuelRef.current;
          }
      }
      
      if (fuelRef.current <= 0 && isInCarNow && Math.abs(velocity) > 0) {
          // Out of gas! Decelerate
          velocity *= 0.95;
          if (Math.abs(velocity) < 0.1) velocity = 0;
      }

      // Food (Hunger) Penalties
      if (foodRef.current <= 0) {
          // Slow down movement if hungry
          if (!isInCarNow) {
             // On foot penalty
             if (Math.abs(inputRef.current.forward) > 0.5) inputRef.current.forward *= 0.5;
          }
      }

      if (!activePosition) {
        // Update Traffic
      trafficCars.forEach(car => {
          car.mesh.position.z += car.speed * car.direction * dt;
          
          // Loop around (expanded bounds)
          if (car.mesh.position.z > 300) car.mesh.position.z = -300;
          if (car.mesh.position.z < -300) car.mesh.position.z = 300;
      });

      scene.render()
        return
      }

      const chunkSize = 120
      const currentChunkX = Math.round(activePosition.x / chunkSize)
      const currentChunkZ = Math.round(activePosition.z / chunkSize)
      const lastChunk = lastChunkCenterRef.current
      if (!lastChunk || lastChunk.x !== currentChunkX || lastChunk.z !== currentChunkZ) {
        lastChunkCenterRef.current = { x: currentChunkX, z: currentChunkZ }
        const activeRadiusChunks = 1
        const centerXWorld = currentChunkX * chunkSize
        const centerZWorld = currentChunkZ * chunkSize
        scene.meshes.forEach(mesh => {
          if (mesh === car || mesh === avatar) return
          if (mesh.name.startsWith('ground') || mesh.name.startsWith('road')) return
          const dx = mesh.position.x - centerXWorld
          const dz = mesh.position.z - centerZWorld
          const distanceChunksX = Math.abs(dx) / chunkSize
          const distanceChunksZ = Math.abs(dz) / chunkSize
          const within = distanceChunksX <= activeRadiusChunks && distanceChunksZ <= activeRadiusChunks
          mesh.setEnabled(within)
        })
      }

      const houseRows = housesRef.current
      let closestHouse: TownHouse | null = null
      let closestHouseDist = Number.POSITIVE_INFINITY
      for (const h of houseRows) {
        const dx = activePosition.x - h.position_x
        const dz = activePosition.z - h.position_z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < closestHouseDist) {
          closestHouseDist = dist
          closestHouse = h
        }
      }

      if (closestHouse && closestHouseDist <= 5) {
        setNearHouse(prev => {
          if (!prev || prev.id !== closestHouse.id) {
            return closestHouse
          }
          return prev
        })
      } else {
        setNearHouse(prev => (prev ? null : prev))
      }

      let closestLocation: TownLocation | null = null
      let closestLocationDist = Number.POSITIVE_INFINITY
      for (const loc of TOWN_LOCATIONS) {
        const dx = activePosition.x - loc.position_x
        const dz = activePosition.z - loc.position_z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < closestLocationDist) {
          closestLocationDist = dist
          closestLocation = loc
        }
      }

      if (closestLocation && closestLocationDist <= 10) {
        setNearLocation(prev => {
          if (!prev || prev.id !== closestLocation.id) {
            return closestLocation
          }
          return prev
        })
      } else {
        setNearLocation(prev => (prev ? null : prev))
      }

      const interactPressed = inputRef.current.interact
      if (interactPressed && !lastInteractRef.current) {
        lastInteractRef.current = true

        if (isRefuelingRef.current) return

        if (isInCarNow) {
             // In Car: Check Gas Station first
             if (closestLocation && closestLocation.type === 'gas' && closestLocationDist <= 10) {
                 if (fuelRef.current < 100) {
                    setIsRefueling(true)
                    isRefuelingRef.current = true
                    setTimeout(() => {
                        fuelRef.current = 100
                        setFuel(100)
                        setIsRefueling(false)
                        isRefuelingRef.current = false
                        toast.success('Refueled! -10 TrollCoins')
                    }, 3000)
                 } else {
                    toast.info('Tank is full!')
                 }
             } else {
                 // Exit Car
                 handleInteract()
             }
        } else {
             // Not In Car: Try entering car first
             handleInteract()
             
             // If we started entering a car (transitioning), stop
             if (isTransitioningRef.current) return

             // Otherwise check buildings
             if (closestHouse && !activeRaidRef.current) {
                setShowHousePanel(true)
             } else if (closestLocation) {
                if (closestLocation.type === 'gas') {
                    toast.info('Bring your vehicle here to refuel.')
                } else if (closestLocation.type === 'church') {
                    if (isChurchOpenRef.current) {
                        toast.success('Entering Church Service...')
                        navigate(closestLocation.route)
                    } else {
                        toast.info('Church is closed. Open Sundays 8am - 2pm.')
                    }
                } else if (closestLocation.id === 'trollgers') {
                     // Buying Food
                     foodRef.current = 100
                     setFood(100)
                     toast.success('Groceries purchased! +Food')
                } else {
                    navigate(closestLocation.route)
                }
             }
        }
      } else if (!interactPressed) {
        lastInteractRef.current = false
      }

      if (inputRef.current.cancel && showHousePanelRef.current) {
        setShowHousePanel(false)
      }

      let speedMetersPerSec = 0
      if (isInCarNow) {
        speedMetersPerSec = Math.abs(velocity)
      } else {
        const scalar = Math.abs(inputRef.current.forward)
        speedMetersPerSec = scalar * onFootSpeed
      }
      const speed = speedMetersPerSec * 3.6
      setSpeedKmh(speed)

      let deg = (headingForState * 180) / Math.PI
      deg = ((deg % 360) + 360) % 360
      setHeadingDeg(deg)
      
      // Update camera target...


      const sinceLastSync = now - lastStateSyncRef.current
      if (sinceLastSync > 1000) {
        lastStateSyncRef.current = now
        void supabase.rpc('update_player_state', {
          p_position_x: activePosition.x,
          p_position_z: activePosition.z,
          p_rotation_y: headingForState,
          p_vehicle: isInCarNow ? 'car' : 'foot'
        })
      }

      // Update Sky & Weather
      const nowTime = new Date();
      const hours = nowTime.getHours() + nowTime.getMinutes() / 60;
       if (skyMaterial) {
           // Map hours (0-24) to inclination
           // 12 -> 0 (Noon)
           // 18 -> 0.5 (Sunset)
           // 6 -> -0.5 (Sunrise)
           skyMaterial.inclination = (hours - 12) / 12;
           
           if (light) {
              const isNight = hours < 6 || hours > 18;
             light.intensity = isNight ? 0.3 : 1.0;
          }
      }

      // Update Traffic
      trafficCars.forEach(car => {
          car.mesh.position.z += car.speed * car.direction * dt;
          
          // Loop around
          if (car.mesh.position.z > 200) car.mesh.position.z = -200;
          if (car.mesh.position.z < -200) car.mesh.position.z = 200;
      });

      scene.render()
    }

    const handleResize = () => {
      engine.resize()
    }

    engine.runRenderLoop(step)

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (raidTimerRef.current !== null) {
        window.clearInterval(raidTimerRef.current)
        raidTimerRef.current = null
      }
      window.clearInterval(multiplayerInterval)
      engine.stopRenderLoop(step)
      scene.dispose()
      engine.dispose()
      engineRef.current = null
      sceneRef.current = null
      carMeshRef.current = null
      avatarMeshRef.current = null
    }
  }, [user, navigate])

  if (!user) return null

  const headingLabel = (() => {
    const deg = headingDeg
    if (deg >= 315 || deg < 45) return 'N'
    if (deg >= 45 && deg < 135) return 'E'
    if (deg >= 135 && deg < 225) return 'S'
    return 'W'
  })()

  const handleStartRaid = async () => {
    if (!nearHouse || nearHouse.is_own || activeRaid) return
    try {
      const { data, error } = await supabase.rpc('start_raid', {
        p_target_house_id: nearHouse.id
      })
      if (error) {
        throw error
      }
      if (!data?.success) {
        if (data?.message) toast.error(data.message)
        return
      }
      const raidId = data.raid_id as string
      const durationSeconds = Number(data.duration_seconds ?? 30)
      const endTime = Date.now() + durationSeconds * 1000
      setActiveRaid({
        raidId,
        houseId: nearHouse.id
      })
      setRaidTimeRemaining(durationSeconds)
      if (raidTimerRef.current !== null) {
        window.clearInterval(raidTimerRef.current)
      }
      raidTimerRef.current = window.setInterval(() => {
        setRaidTimeRemaining(_prev => {
          const now = Date.now()
          const remaining = Math.max(0, Math.round((endTime - now) / 1000))
          if (remaining <= 0) {
            if (raidTimerRef.current !== null) {
              window.clearInterval(raidTimerRef.current)
              raidTimerRef.current = null
            }
            return 0
          }
          return remaining
        })
      }, 1000)
      toast.info('Raid started')
      setShowHousePanel(false)

      window.setTimeout(async () => {
        await handleFinishRaid(raidId, nearHouse)
      }, durationSeconds * 1000 + 200)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start raid')
    }
  }

  const handleFinishRaid = async (raidId: string, house: TownHouse) => {
    const defense = Number(house.metadata?.defense_rating ?? 1)
    const attack = 1.2
    const successChance = attack / (attack + defense)
    const roll = Math.random()
    const outcome: 'success' | 'failure' = roll <= successChance ? 'success' : 'failure'
    let loot = 0
    if (outcome === 'success') {
      loot = Math.round(10 + Math.random() * 40)
    }

    try {
      const { error } = await supabase.rpc('finish_raid', {
        p_raid_id: raidId,
        p_outcome: outcome,
        p_loot: loot
      })
      if (error) {
        throw error
      }
      setActiveRaid({
        raidId,
        houseId: house.id,
        outcome,
        loot
      })
      if (outcome === 'success') {
        toast.success(`Raid success! Looted ${loot} TrollCoins`)
      } else {
        toast.error('Raid failed. Heat increased.')
      }
      void (async () => {
        try {
          const { data: refreshed, error: refreshError } = await supabase.rpc('get_town_houses')
          if (!refreshError && Array.isArray(refreshed)) {
            const normalized: TownHouse[] = refreshed.map((row: any) => ({
              id: row.id,
              owner_user_id: row.owner_user_id,
              parcel_id: row.parcel_id,
              position_x: Number(row.position_x ?? 0),
              position_z: Number(row.position_z ?? 0),
              metadata: row.metadata || {},
              parcel_center_x: Number(row.parcel_center_x ?? 0),
              parcel_center_z: Number(row.parcel_center_z ?? 0),
              parcel_size_x: Number(row.parcel_size_x ?? 12),
              parcel_size_z: Number(row.parcel_size_z ?? 12),
              owner_username: row.owner_username ?? null,
              is_own: Boolean(row.is_own),
              last_raid_at: row.last_raid_at ?? null,
              last_raid_outcome: row.last_raid_outcome ?? null
            }))
            housesRef.current = normalized
            setHouses(normalized)
          }
        } catch {
        }
      })()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to finish raid')
    }
  }

  return (
    <div className="relative w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full outline-none touch-none" />
      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-2 text-xs sm:text-sm">
        {/* Removed old Speed UI */}
      </div>
      
      {/* -- GTA Style HUD -- */}
      {/* Mini-Map (Bottom Left) */}
      <div className="pointer-events-none absolute bottom-8 left-8 w-48 h-32 rounded-lg border-4 border-black/80 bg-gray-900/90 overflow-hidden shadow-2xl flex items-center justify-center">
          <div className="relative w-full h-full">
              {/* Fake Map Grid */}
              <div className="absolute inset-0 opacity-30" 
                   style={{ 
                       backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)', 
                       backgroundSize: '10px 10px',
                       transform: `rotate(${-headingDeg}deg) scale(2)` 
                   }}>
              </div>
              
              {/* Player Arrow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-white z-10"></div>
              
              {/* Nearby POIs (Mock) */}
              {nearLocation && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 rounded-full" 
                       style={{ transform: `translate(${Math.sin(headingDeg * Math.PI/180)*20}px, ${-Math.cos(headingDeg * Math.PI/180)*20}px)` }}>
                  </div>
              )}
          </div>
          
          {/* Health/Armor Bars under map */}
          <div className="absolute bottom-0 left-0 right-0 h-2 flex">
              <div className="w-1/2 h-full bg-green-500 border-r border-black/50"></div>
              <div className="w-1/2 h-full bg-blue-500"></div>
          </div>
      </div>

      {/* Speedometer (Bottom Right) */}
      <div className="pointer-events-none absolute bottom-8 right-8 flex flex-col items-end">
          <div className="text-4xl font-black text-white italic tracking-tighter drop-shadow-lg">
              {Math.round(speedKmh)} <span className="text-xl text-gray-400 font-bold not-italic">KMH</span>
          </div>
          <div className="w-32 h-2 bg-gray-800 rounded-full mt-1 overflow-hidden skew-x-12">
              <div className="h-full bg-yellow-500" style={{ width: `${Math.min(100, (speedKmh / 200) * 100)}%` }}></div>
          </div>
          <div className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-widest">
              {activeVehicleRef.current ? activeVehicleRef.current.replace('playerCar', 'Personal Vehicle') : 'On Foot'}
          </div>
      </div>
      
      {/* Troll Coins (Top Right HUD) - Real Balance from Database */}
      <div className="pointer-events-none absolute top-4 right-4 flex flex-col items-end">
         <div className="text-3xl font-black text-green-400 drop-shadow-md flex items-center gap-1 tabular-nums">
             <span>$</span>
             <span>{Number(coinBalance).toLocaleString()}</span>
         </div>
         <div className="text-xs font-bold text-green-300 uppercase tracking-wider bg-black/70 px-3 py-1 rounded border border-green-500/30">
             Troll Coins
         </div>
      </div>

      {/* Wanted Level (Top Right) */}
      {activeRaid && (
          <div className="pointer-events-none absolute top-16 right-4 flex gap-1">
              {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-6 h-6 rounded-full border-2 border-white/50 ${i < 3 ? 'bg-white animate-pulse' : 'bg-transparent'}`}></div>
              ))}
          </div>
      )}
      
      {/* -- Customization UI Overlay (First Load / Wardrobe) -- */}
      {(showWardrobe || firstLoad) && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-8">
              <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">
                  Character Creator
              </h1>
              <p className="text-gray-400 mb-8">Customize your Troll Town Citizen</p>
              
              <div className="flex gap-8 w-full max-w-4xl">
                  {/* Left Panel: Categories */}
                  <div className="w-1/3 flex flex-col gap-2">
                      <div className="bg-gray-800 p-4 rounded-lg">
                          <h3 className="text-white font-bold mb-2">Skin Tone</h3>
                          <div className="flex gap-2 flex-wrap">
                              {['#f5d0b0', '#e0ac69', '#8d5524', '#3c2e28'].map(c => (
                                  <button 
                                      key={c}
                                      className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition-all"
                                      style={{ backgroundColor: c }}
                                      onClick={() => {
                                          const hex = c.replace('#','');
                                          const r = parseInt(hex.substring(0,2), 16)/255;
                                          const g = parseInt(hex.substring(2,4), 16)/255;
                                          const b = parseInt(hex.substring(4,6), 16)/255;
                                          setCharacterAppearance(p => ({ ...p, skinColor: new Color3(r,g,b) }));
                                      }}
                                  />
                              ))}
                          </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg">
                          <h3 className="text-white font-bold mb-2">Top Color</h3>
                          <div className="flex gap-2 flex-wrap">
                              {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'].map(c => (
                                  <button 
                                      key={c}
                                      className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition-all"
                                      style={{ backgroundColor: c }}
                                      onClick={() => {
                                          const hex = c.replace('#','');
                                          const r = parseInt(hex.substring(0,2), 16)/255;
                                          const g = parseInt(hex.substring(2,4), 16)/255;
                                          const b = parseInt(hex.substring(4,6), 16)/255;
                                          setCharacterAppearance(p => ({ ...p, topColor: new Color3(r,g,b) }));
                                      }}
                                  />
                              ))}
                          </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg">
                          <h3 className="text-white font-bold mb-2">Pants Color</h3>
                          <div className="flex gap-2 flex-wrap">
                              {['#1a1a1a', '#334455', '#554433', '#888888'].map(c => (
                                  <button 
                                      key={c}
                                      className="w-8 h-8 rounded-full border-2 border-white/20 hover:border-white transition-all"
                                      style={{ backgroundColor: c }}
                                      onClick={() => {
                                          const hex = c.replace('#','');
                                          const r = parseInt(hex.substring(0,2), 16)/255;
                                          const g = parseInt(hex.substring(2,4), 16)/255;
                                          const b = parseInt(hex.substring(4,6), 16)/255;
                                          setCharacterAppearance(p => ({ ...p, bottomColor: new Color3(r,g,b) }));
                                      }}
                                  />
                              ))}
                          </div>
                      </div>
                  </div>
                  
                  {/* Center: Preview (Placeholder) */}
                  <div className="w-1/3 bg-gray-800/50 rounded-lg flex items-center justify-center border border-white/10 relative overflow-hidden">
                      <div className="text-gray-500 text-center p-4">
                          <div className="text-6xl mb-4">👤</div>
                          <p>Preview updates in world</p>
                      </div>
                      {/* We could render a secondary scene here but let's keep it simple for now */}
                  </div>
                  
                  {/* Right: Actions */}
                  <div className="w-1/3 flex flex-col justify-end gap-4">
                      <button 
                          onClick={() => {
                              // Randomize
                              setCharacterAppearance({
                                  skinColor: new Color3(Math.random(), Math.random(), Math.random()),
                                  topColor: new Color3(Math.random(), Math.random(), Math.random()),
                                  bottomColor: new Color3(Math.random(), Math.random(), Math.random()),
                                  hairStyle: 'short',
                                  topStyle: 'tshirt'
                              });
                          }}
                          className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                      >
                          Randomize
                      </button>
                      
                      <button 
                          onClick={() => {
                              saveGame();
                              setShowWardrobe(false);
                              setFirstLoad(false);
                              // Force re-create char
                              if (avatarMeshRef.current && createCharacterRef.current) {
                                  createCharacterRef.current(avatarMeshRef.current as Mesh, characterAppearance);
                              }
                          }}
                          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-lg shadow-lg shadow-green-900/50 transition-all transform hover:scale-105"
                      >
                          SAVE & PLAY
                      </button>
                  </div>
              </div>
          </div>
      )}

      
      {isRefueling && (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
            <div className="text-yellow-400 font-bold text-xl animate-pulse">REFUELING...</div>
            <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden border border-white/20">
                <div className="h-full bg-yellow-500 animate-[width_3s_ease-in-out_infinite]" style={{width: '100%'}}></div>
            </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-gray-300 px-3 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span>W/S: throttle</span>
        <span>A/D: steer</span>
        <span>Space: handbrake</span>
        <span>Shift: boost</span>
        <span>Gamepad: sticks + triggers, A interact, B cancel, RB boost</span>
      </div>
      {nearLocation && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-xs sm:text-sm text-cyan-300 px-3 py-2 rounded-full bg-black/70 border border-cyan-500/40 backdrop-blur flex items-center gap-2">
          <span className="font-semibold">Press E / A to enter</span>
          <span className="text-gray-300">{nearLocation.name}</span>
        </div>
      )}
      {loadingHouses && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <TrollCitySpinner text="Spawning Trolls Town houses..." subtext="Assigning your home on the map" />
          </div>
        </div>
      )}
      {nearHouse && !showHousePanel && !activeRaid && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-xs sm:text-sm text-emerald-300 px-3 py-2 rounded-full bg-black/70 border border-emerald-500/40 backdrop-blur flex items-center gap-2">
          <span className="font-semibold">Press E / A to interact</span>
          <span className="text-gray-400">
            {nearHouse.is_own ? 'Your house' : `House of ${nearHouse.owner_username || 'Citizen'}`}
          </span>
        </div>
      )}
      {(showHousePanel || activeRaid) && nearHouse && (
        <div className="pointer-events-auto absolute bottom-4 right-4 w-72 max-w-[90vw] bg-black/80 border border-white/15 rounded-2xl p-4 text-xs sm:text-sm text-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400">Trolls Town House</div>
              <div className="font-semibold text-white">
                {nearHouse.is_own ? 'Your House' : `${nearHouse.owner_username || 'Citizen'}'s House`}
              </div>
            </div>
            <button
              onClick={() => setShowHousePanel(false)}
              className="text-[11px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          </div>

          <div className="space-y-1 text-[11px] text-gray-400">
            <div>
              Level: {Number(nearHouse.metadata?.level ?? 1)}
            </div>
            <div>
              Defense: {Number(nearHouse.metadata?.defense_rating ?? 1).toFixed(2)}
            </div>
            {nearHouse.last_raid_at && (
              <div>
                Last raid: {nearHouse.last_raid_outcome || 'unknown'}
              </div>
            )}
          </div>

          {activeRaid && activeRaid.houseId === nearHouse.id ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-purple-300">Raid In Progress</div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {raidTimeRemaining !== null && raidTimeRemaining > 0
                    ? `Time remaining: ${raidTimeRemaining}s`
                    : activeRaid.outcome
                      ? activeRaid.outcome === 'success'
                        ? `Raid success. Looted ${activeRaid.loot ?? 0} coins.`
                        : 'Raid failed.'
                      : 'Resolving raid...'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setShowHousePanel(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
              >
                View House
              </button>
              {!nearHouse.is_own && (
                <button
                  onClick={handleStartRaid}
                  className="flex-1 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-[11px] font-semibold"
                >
                  Raid House
                </button>
              )}
            </div>
          )}

          {loadingMultiplayer && (
            <div className="text-[10px] text-gray-500">
              Syncing nearby players...
            </div>
          )}
        </div>
      )}
      {/* -- Settings Menu -- */}
      {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-8">
              <div className="w-full max-w-5xl h-[80vh] bg-gray-900 border border-white/10 rounded-xl flex overflow-hidden shadow-2xl">
                  {/* Sidebar */}
                  <div className="w-64 bg-black/50 p-6 border-r border-white/5 flex flex-col gap-2">
                      <h2 className="text-2xl font-black text-white mb-6 tracking-tighter uppercase">Settings</h2>
                      {['Controls', 'Audio', 'Graphics', 'Gameplay', 'Multiplayer'].map(tab => (
                          <button key={tab} className="text-left px-4 py-3 rounded hover:bg-white/10 text-gray-300 font-bold uppercase tracking-wider transition-colors focus:bg-white/20">
                              {tab}
                          </button>
                      ))}
                      <div className="mt-auto">
                          <button 
                              onClick={() => setShowSettings(false)}
                              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded uppercase tracking-wider"
                          >
                              Close
                          </button>
                      </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 p-8 overflow-y-auto">
                      <h3 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4">Controls</h3>
                      
                      <div className="grid grid-cols-2 gap-8">
                          {/* Gamepad Visual */}
                          <div className="bg-gray-800 p-6 rounded-lg border border-white/5">
                              <h4 className="text-white font-bold mb-4 uppercase text-sm tracking-widest text-gray-400">Controller Layout (Xbox)</h4>
                              <div className="relative w-full aspect-video bg-black/30 rounded border border-white/5 flex items-center justify-center">
                                  <div className="text-gray-500 text-xs text-center">
                                      [ RT ] Accelerate<br/>
                                      [ LT ] Brake/Reverse<br/>
                                      [ LS ] Steer<br/>
                                      [ A ] Interact<br/>
                                      [ B ] Handbrake<br/>
                                      [ X ] Boost
                                  </div>
                              </div>
                          </div>
                          
                          {/* Options */}
                          <div className="space-y-6">
                               <div>
                                  <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Gamepad Deadzone</label>
                                  <input 
                                      type="range" 
                                      min="0" max="0.5" step="0.01" 
                                      value={settings.gamepadDeadzone}
                                      onChange={e => setSettings(p => ({ ...p, gamepadDeadzone: parseFloat(e.target.value) }))}
                                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="text-right text-white font-mono mt-1">{settings.gamepadDeadzone.toFixed(2)}</div>
                               </div>
                               
                               <div className="flex items-center justify-between p-4 bg-gray-800 rounded">
                                   <span className="text-white font-bold">Invert Y-Axis</span>
                                   <button 
                                       onClick={() => setSettings(p => ({ ...p, invertY: !p.invertY }))}
                                       className={`w-12 h-6 rounded-full relative transition-colors ${settings.invertY ? 'bg-green-500' : 'bg-gray-600'}`}
                                   >
                                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.invertY ? 'left-7' : 'left-1'}`} />
                                   </button>
                               </div>
                          </div>
                      </div>
                      
                      <h3 className="text-3xl font-bold text-white mt-12 mb-8 border-b border-white/10 pb-4">Audio & Voice</h3>
                      <div className="space-y-6 max-w-2xl">
                           <div>
                              <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Master Volume</label>
                              <input 
                                  type="range" 
                                  min="0" max="100" 
                                  value={settings.masterVolume}
                                  onChange={e => setSettings(p => ({ ...p, masterVolume: parseInt(e.target.value) }))}
                                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                              />
                           </div>
                           
                           <div className="flex items-center justify-between p-4 bg-gray-800 rounded border border-white/5">
                               <div>
                                   <div className="text-white font-bold">Voice Chat</div>
                                   <div className="text-gray-400 text-xs">Global proximity chat</div>
                               </div>
                               <button 
                                   onClick={() => setSettings(p => ({ ...p, voiceEnabled: !p.voiceEnabled }))}
                                   className={`w-12 h-6 rounded-full relative transition-colors ${settings.voiceEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                               >
                                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.voiceEnabled ? 'left-7' : 'left-1'}`} />
                               </button>
                           </div>
                           
                           {settings.voiceEnabled && (
                               <div className="pl-4 border-l-2 border-white/10 space-y-4">
                                   <div>
                                      <label className="block text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Mic Sensitivity</label>
                                      <input 
                                          type="range" 
                                          min="0" max="100" 
                                          value={settings.micSensitivity}
                                          onChange={e => setSettings(p => ({ ...p, micSensitivity: parseInt(e.target.value) }))}
                                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                      />
                                   </div>
                                   <div className="flex items-center gap-4">
                                       <div className={`w-3 h-3 rounded-full ${micActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                       <span className="text-gray-400 text-sm">Microphone Status</span>
                                   </div>
                               </div>
                           )}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}

export default TrollsTown3DPage
