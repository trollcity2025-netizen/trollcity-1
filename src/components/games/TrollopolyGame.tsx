// TrollopolyGame.tsx - Main 3D Board Game Component

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TrollopolyGameState, TrollopolyPlayer, Property, CameraPosition } from '@/lib/game/types/TrollopolyTypes';
import { GameAction } from '@/lib/game/InternetGameTypes';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Video, VideoOff, Mic, MicOff, 
  Users, Eye, MessageSquare, Send,
  Dice5, Home, Coins, ArrowRight
} from 'lucide-react';

interface TrollopolyGameProps {
  gameState: TrollopolyGameState;
  playerId: string;
  onAction: (action: GameAction) => void;
  isHost: boolean;
  isSpectator?: boolean;
  streamId?: string;
}

// Vehicle colors
const VEHICLE_COLORS = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];

export const TrollopolyGame: React.FC<TrollopolyGameProps> = ({
  gameState,
  playerId,
  onAction,
  isHost,
  isSpectator = false,
  streamId,
}) => {
  const { profile } = useAuthStore();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vehiclesRef = useRef<Map<string, THREE.Group>>(new Map());
  const buildingsRef = useRef<Map<number, THREE.Group>>(new Map());
  const diceRef = useRef<{ die1: THREE.Mesh; die2: THREE.Mesh } | null>(null);
  const animationFrameRef = useRef<number>();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [cameraStates, setCameraStates] = useState<Map<string, { enabled: boolean; muted: boolean }>>(new Map());
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);

  // Get current player
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId && !isSpectator;

  // Initialize chat
  const { messages, sendMessage } = useStreamChat({
    streamId: streamId || gameState.matchId,
    hostId: gameState.players[0]?.id || '',
    isHost: isHost,
  });

  // Initialize 3D scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 20, 60);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 25, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 15;
    controls.maxDistance = 50;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(10, 20, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);

    // City lights
    const cityLight1 = new THREE.PointLight(0xffaa00, 0.5, 10);
    cityLight1.position.set(5, 5, 5);
    scene.add(cityLight1);

    const cityLight2 = new THREE.PointLight(0x00aaff, 0.5, 10);
    cityLight2.position.set(-5, 5, -5);
    scene.add(cityLight2);

    // Create the board
    createBoard(scene);

    // Create vehicles for each player
    gameState.players.forEach((player, index) => {
      createVehicle(scene, player, index);
    });

    // Create dice
    createDice(scene);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update vehicle positions when game state changes
  useEffect(() => {
    if (!sceneRef.current) return;

    gameState.players.forEach((player, index) => {
      updateVehiclePosition(player, index);
    });
  }, [gameState.players]);

  // Animate dice rolling
  useEffect(() => {
    if (!diceRef.current || !gameState.dice.isRolling) return;

    const animateDice = () => {
      if (!diceRef.current) return;
      
      diceRef.current.die1.rotation.x += 0.2;
      diceRef.current.die1.rotation.y += 0.15;
      diceRef.current.die2.rotation.x += 0.18;
      diceRef.current.die2.rotation.y += 0.12;

      if (gameState.dice.isRolling) {
        requestAnimationFrame(animateDice);
      } else {
        // Set final rotation based on dice values
        setDiceRotation(diceRef.current.die1, gameState.dice.die1);
        setDiceRotation(diceRef.current.die2, gameState.dice.die2);
      }
    };

    animateDice();
  }, [gameState.dice.isRolling, gameState.dice.die1, gameState.dice.die2]);

  // Highlight current player's camera when they roll
  useEffect(() => {
    if (gameState.dice.isRolling) {
      const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;
      setHighlightedPlayer(currentPlayerId);
      
      const timeout = setTimeout(() => {
        setHighlightedPlayer(null);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [gameState.dice.isRolling, gameState.currentPlayerIndex, gameState.players]);

  // Handle chat submission
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    await sendMessage(chatMessage);
    setChatMessage('');
  };

  // Handle dice roll
  const handleRollDice = () => {
    if (!isCurrentTurn || gameState.phase !== 'waiting_for_roll') return;
    
    onAction({
      type: 'roll_dice',
      payload: {},
      timestamp: Date.now(),
      playerId,
    });
  };

  // Handle buy property
  const handleBuyProperty = () => {
    if (!isCurrentTurn) return;
    
    onAction({
      type: 'buy_property',
      payload: {},
      timestamp: Date.now(),
      playerId,
    });
  };

  // Toggle camera
  const toggleCamera = (targetPlayerId: string) => {
    setCameraStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(targetPlayerId) || { enabled: true, muted: false };
      newStates.set(targetPlayerId, { ...current, enabled: !current.enabled });
      return newStates;
    });
  };

  // Toggle mute
  const toggleMute = (targetPlayerId: string) => {
    setCameraStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(targetPlayerId) || { enabled: true, muted: false };
      newStates.set(targetPlayerId, { ...current, muted: !current.muted });
      return newStates;
    });
  };

  // Create the 3D board
  const createBoard = (scene: THREE.Scene) => {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a3e,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads
    const roadWidth = 1.5;
    const roadLength = 16;
    const roadMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.9,
    });

    // Create roads in a square
    const roadPositions = [
      { x: 0, z: 7.5, rot: 0 },      // Bottom
      { x: 0, z: -7.5, rot: 0 },     // Top
      { x: -7.5, z: 0, rot: Math.PI / 2 },  // Left
      { x: 7.5, z: 0, rot: Math.PI / 2 },   // Right
    ];

    roadPositions.forEach(pos => {
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLength, roadWidth),
        roadMaterial
      );
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = pos.rot;
      road.position.set(pos.x, 0.02, pos.z);
      road.receiveShadow = true;
      scene.add(road);
    });

    // Create properties/buildings
    gameState.properties.forEach((property, index) => {
      if (property.type !== 'special') {
        createBuilding(scene, property, index);
      } else {
        createSpecialSpace(scene, property, index);
      }
    });

    // Center decoration
    const centerGeometry = new THREE.CylinderGeometry(3, 3, 0.5, 32);
    const centerMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a4a6e,
      roughness: 0.5,
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.position.y = 0.25;
    center.receiveShadow = true;
    scene.add(center);

    // Trollopoly sign
    const signGeometry = new THREE.BoxGeometry(4, 0.8, 0.2);
    const signMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 0.6, 0);
    sign.rotation.x = -Math.PI / 6;
    scene.add(sign);
  };

  // Create a building
  const createBuilding = (scene: THREE.Scene, property: Property, index: number) => {
    const group = new THREE.Group();
    
    // Base
    const baseGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.8);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.1;
    base.castShadow = true;
    group.add(base);

    // Building
    const height = property.type === 'luxury' ? 2 : 
                   property.type === 'government' ? 1.8 :
                   property.type === 'shopping' ? 1.6 :
                   property.type === 'entertainment' ? 1.5 :
                   property.type === 'media' ? 1.4 :
                   property.type === 'business' ? 1.2 :
                   property.type === 'residential' ? 1 : 0.8;

    const buildingGeometry = new THREE.BoxGeometry(0.6, height, 0.6);
    const buildingMaterial = new THREE.MeshStandardMaterial({ 
      color: property.color || 0x888888,
      roughness: 0.6,
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.y = height / 2 + 0.2;
    building.castShadow = true;
    group.add(building);

    // Windows
    const windowGeometry = new THREE.PlaneGeometry(0.15, 0.15);
    const windowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffaa,
      transparent: true,
      opacity: 0.8,
    });
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const window = new THREE.Mesh(windowGeometry, windowMaterial);
        window.position.set(
          -0.15 + j * 0.3,
          0.5 + i * 0.4,
          0.31
        );
        group.add(window);
      }
    }

    group.position.set(property.position.x, 0, property.position.z);
    group.rotation.y = property.rotation;
    scene.add(group);
    buildingsRef.current.set(index, group);
  };

  // Create special space (GO, Jail, etc.)
  const createSpecialSpace = (scene: THREE.Scene, property: Property, index: number) => {
    const group = new THREE.Group();
    
    if (property.name === 'City Center') {
      // GO - Large golden platform
      const platformGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32);
      const platformMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        metalness: 0.5,
        roughness: 0.3,
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.y = 0.15;
      platform.receiveShadow = true;
      group.add(platform);

      // GO text
      const textGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.4);
      const textMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      const text = new THREE.Mesh(textGeometry, textMaterial);
      text.position.y = 0.35;
      group.add(text);
    } else if (property.name === 'Troll Jail') {
      // Jail - Dark fortress style
      const jailGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const jailMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
      const jail = new THREE.Mesh(jailGeometry, jailMaterial);
      jail.position.y = 0.75;
      jail.castShadow = true;
      group.add(jail);

      // Bars
      for (let i = 0; i < 4; i++) {
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x666666 })
        );
        bar.position.set(-0.4 + i * 0.27, 0.8, 0.76);
        group.add(bar);
      }
    } else if (property.name === 'Public Park') {
      // Park - Green with trees
      const parkGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
      const parkMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
      const park = new THREE.Mesh(parkGeometry, parkMaterial);
      park.position.y = 0.05;
      group.add(park);

      // Trees
      for (let i = 0; i < 3; i++) {
        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.08, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x8b4513 })
        );
        trunk.position.y = 0.15;
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(0.2, 0.5, 8),
          new THREE.MeshStandardMaterial({ color: 0x006400 })
        );
        leaves.position.y = 0.5;
        treeGroup.add(trunk, leaves);
        treeGroup.position.set(
          Math.cos(i * Math.PI * 2 / 3) * 0.5,
          0,
          Math.sin(i * Math.PI * 2 / 3) * 0.5
        );
        group.add(treeGroup);
      }
    }

    group.position.set(property.position.x, 0, property.position.z);
    scene.add(group);
    buildingsRef.current.set(index, group);
  };

  // Create a vehicle for a player
  const createVehicle = (scene: THREE.Scene, player: TrollopolyPlayer, index: number) => {
    const group = new THREE.Group();
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    // Vehicle body
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.7);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: color,
      metalness: 0.3,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.2;
    body.castShadow = true;
    group.add(body);

    // Vehicle top
    const topGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.4);
    const topMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.3,
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.375;
    group.add(top);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const wheelPositions = [
      { x: -0.22, z: 0.25 },
      { x: 0.22, z: 0.25 },
      { x: -0.22, z: -0.25 },
      { x: 0.22, z: -0.25 },
    ];

    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(pos.x, 0.08, pos.z);
      group.add(wheel);
    });

    // Headlights
    const lightGeometry = new THREE.SphereGeometry(0.05);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    const leftLight = new THREE.Mesh(lightGeometry, lightMaterial);
    leftLight.position.set(-0.12, 0.2, 0.36);
    group.add(leftLight);
    const rightLight = new THREE.Mesh(lightGeometry, lightMaterial);
    rightLight.position.set(0.12, 0.2, 0.36);
    group.add(rightLight);

    // Position vehicle at start
    const startProperty = gameState.properties[0];
    const offset = index * 0.3;
    group.position.set(
      startProperty.position.x + offset,
      0,
      startProperty.position.z + offset
    );

    scene.add(group);
    vehiclesRef.current.set(player.id, group);
  };

  // Update vehicle position
  const updateVehiclePosition = (player: TrollopolyPlayer, index: number) => {
    const vehicle = vehiclesRef.current.get(player.id);
    if (!vehicle) return;

    const property = gameState.properties[player.position];
    const offset = index * 0.3;
    
    // Animate to new position
    const targetX = property.position.x + offset;
    const targetZ = property.position.z + offset;
    
    // Calculate rotation to face movement direction
    const currentX = vehicle.position.x;
    const currentZ = vehicle.position.z;
    const angle = Math.atan2(targetX - currentX, targetZ - currentZ);
    
    vehicle.position.set(targetX, 0, targetZ);
    vehicle.rotation.y = angle;
  };

  // Create dice
  const createDice = (scene: THREE.Scene) => {
    const dieGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const dieMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.3,
    });

    const die1 = new THREE.Mesh(dieGeometry, dieMaterial);
    die1.position.set(-0.4, 0.5, 0);
    die1.castShadow = true;
    scene.add(die1);

    const die2 = new THREE.Mesh(dieGeometry, dieMaterial);
    die2.position.set(0.4, 0.5, 0);
    die2.castShadow = true;
    scene.add(die2);

    // Add dots to dice
    addDiceDots(die1);
    addDiceDots(die2);

    diceRef.current = { die1, die2 };
  };

  // Add dots to dice faces
  const addDiceDots = (die: THREE.Mesh) => {
    const dotGeometry = new THREE.CircleGeometry(0.03, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Face 1 (front)
    const dot1 = new THREE.Mesh(dotGeometry, dotMaterial);
    dot1.position.set(0, 0, 0.151);
    die.add(dot1);

    // Face 6 (back) - 6 dots
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      const row = Math.floor(i / 2);
      const col = i % 2;
      dot.position.set(-0.08 + col * 0.16, -0.08 + row * 0.08, -0.151);
      dot.rotation.y = Math.PI;
      die.add(dot);
    }
  };

  // Set dice rotation based on value
  const setDiceRotation = (die: THREE.Mesh, value: number) => {
    const rotations: Record<number, { x: number; y: number }> = {
      1: { x: 0, y: 0 },
      2: { x: -Math.PI / 2, y: 0 },
      3: { x: 0, y: Math.PI / 2 },
      4: { x: 0, y: -Math.PI / 2 },
      5: { x: Math.PI / 2, y: 0 },
      6: { x: Math.PI, y: 0 },
    };
    
    const rot = rotations[value] || rotations[1];
    die.rotation.x = rot.x;
    die.rotation.y = rot.y;
  };

  // Get camera position based on player count and index
  const getCameraCorner = (playerIndex: number, totalPlayers: number): CameraPosition['corner'] => {
    const corners: CameraPosition['corner'][] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    
    if (totalPlayers === 2) {
      return playerIndex === 0 ? 'top-left' : 'top-right';
    } else if (totalPlayers === 3) {
      return corners[playerIndex] || 'bottom-left';
    }
    return corners[playerIndex] || 'top-left';
  };

  // Get corner styles
  const getCornerStyles = (corner: CameraPosition['corner']) => {
    switch (corner) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
    }
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* 3D Board Canvas */}
      <div 
        ref={mountRef} 
        className="absolute inset-0"
        style={{ cursor: 'grab' }}
      />

      {/* Player Cameras - Corner Layout */}
      {gameState.players.map((player, index) => {
        const corner = getCameraCorner(index, gameState.players.length);
        const cameraState = cameraStates.get(player.id) || { enabled: true, muted: false };
        const isHighlighted = highlightedPlayer === player.id;
        
        return (
          <div
            key={player.id}
            className={`absolute ${getCornerStyles(corner)} z-20 transition-all duration-300`}
          >
            <div 
              className={`
                relative bg-slate-800 rounded-xl overflow-hidden border-2
                ${isHighlighted ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-slate-600'}
                transition-all duration-300
              `}
              style={{ width: '200px', height: '150px' }}
            >
              {/* Camera View */}
              <div className="relative w-full h-full bg-black">
                {player.id === playerId && cameraState.enabled ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-slate-800">
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                      style={{ backgroundColor: VEHICLE_COLORS[index % VEHICLE_COLORS.length] }}
                    >
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                
                {/* Connection indicator */}
                <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                
                {/* Username */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-sm font-medium truncate">
                    {player.username} {player.id === playerId && '(You)'}
                  </p>
                  <p className="text-yellow-400 text-xs">💰 {player.coins}</p>
                </div>
                
                {/* Controls */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => toggleMute(player.id)}
                    className={`p-1 rounded ${cameraState.muted ? 'bg-red-500/80' : 'bg-slate-700/80'} hover:opacity-80`}
                  >
                    {cameraState.muted ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                  <button
                    onClick={() => toggleCamera(player.id)}
                    className={`p-1 rounded ${!cameraState.enabled ? 'bg-red-500/80' : 'bg-slate-700/80'} hover:opacity-80`}
                  >
                    {!cameraState.enabled ? <VideoOff size={14} /> : <Video size={14} />}
                  </button>
                </div>
                
                {/* Turn indicator */}
                {gameState.currentPlayerIndex === index && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-500 rounded-full text-xs text-white font-medium">
                    TURN
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Spectator Count */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-full border border-slate-600">
          <Eye size={18} className="text-slate-400" />
          <span className="text-white font-medium">{gameState.spectatorCount} watching</span>
        </div>
      </div>

      {/* Game Controls */}
      {!isSpectator && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {isCurrentTurn && gameState.phase === 'waiting_for_roll' && (
            <button
              onClick={handleRollDice}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
            >
              <Dice5 size={24} />
              Roll Dice
            </button>
          )}
          
          {isCurrentTurn && gameState.phase === 'property_action' && (
            <>
              <button
                onClick={handleBuyProperty}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105"
              >
                <Home size={24} />
                Buy Property
              </button>
              <button
                onClick={() => onAction({ type: 'end_turn', payload: {}, timestamp: Date.now(), playerId })}
                className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl transition-all"
              >
                Skip
              </button>
            </>
          )}

          {isCurrentTurn && gameState.phase === 'jail' && (
            <>
              <button
                onClick={() => onAction({ type: 'pay_jail_fine', payload: {}, timestamp: Date.now(), playerId })}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold rounded-xl shadow-lg"
              >
                <Coins size={20} />
                Pay 50
              </button>
              {currentPlayer?.hasGetOutOfJailFree && (
                <button
                  onClick={() => onAction({ type: 'use_jail_card', payload: {}, timestamp: Date.now(), playerId })}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-xl shadow-lg"
                >
                  Use Card
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-80 bg-slate-800/95 rounded-xl border border-slate-600 overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-3 bg-slate-700/50 border-b border-slate-600">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-slate-400" />
              <span className="text-white font-medium">Game Chat</span>
            </div>
            <button
              onClick={() => setShowChat(!showChat)}
              className="p-1 hover:bg-slate-600 rounded"
            >
              ×
            </button>
          </div>
          
          {/* Messages */}
          <div className="h-64 overflow-y-auto p-3 space-y-2">
            {messages.slice(-20).map((msg) => (
              <div key={msg.id} className={`text-sm ${msg.type === 'system' ? 'text-yellow-400 italic' : 'text-slate-200'}`}>
                {msg.type === 'system' ? (
                  <span>{msg.content}</span>
                ) : (
                  <>
                    <span className="font-medium text-blue-400">{msg.sender_name || msg.user_profiles?.username}: </span>
                    <span>{msg.content}</span>
                  </>
                )}
              </div>
            ))}
            
            {/* Game Log */}
            {gameState.gameLog.slice(-5).map((log) => (
              <div key={log.id} className="text-xs text-slate-400 italic">
                {log.message}
              </div>
            ))}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-slate-600">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Chat Toggle Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-600 text-white transition-all"
        >
          <MessageSquare size={20} />
        </button>
      )}

      {/* Property Info Panel */}
      {currentPlayer && (
        <div className="absolute bottom-4 right-4 z-20">
          <div className="bg-slate-800/95 rounded-xl border border-slate-600 p-4 w-64">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <Home size={18} className="text-blue-400" />
              Current Space
            </h3>
            {(() => {
              const property = gameState.properties[currentPlayer.position];
              return (
                <div>
                  <p className="text-lg font-medium text-white">{property.name}</p>
                  <p className="text-sm text-slate-400 capitalize">{property.type}</p>
                  {property.price > 0 && (
                    <p className="text-yellow-400 font-medium">Price: {property.price} coins</p>
                  )}
                  {property.ownerId && (
                    <p className="text-sm text-slate-300">
                      Owner: {gameState.players.find(p => p.id === property.ownerId)?.username}
                    </p>
                  )}
                  {property.houseCount > 0 && (
                    <p className="text-sm text-green-400">Houses: {property.houseCount}</p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Dice Display */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-4">
          <div className={`
            w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 shadow-lg
            ${gameState.dice.isRolling ? 'animate-pulse' : ''}
          `}>
            {gameState.dice.die1}
          </div>
          <span className="text-2xl text-white font-bold">+</span>
          <div className={`
            w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 shadow-lg
            ${gameState.dice.isRolling ? 'animate-pulse' : ''}
          `}>
            {gameState.dice.die2}
          </div>
          <span className="text-2xl text-white font-bold">=</span>
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
            {gameState.dice.die1 + gameState.dice.die2}
          </div>
        </div>
      </div>

      {/* Spectator Badge */}
      {isSpectator && (
        <div className="absolute top-20 left-4 z-20">
          <div className="px-4 py-2 bg-purple-600/90 rounded-full text-white font-medium">
            👀 Spectator Mode
          </div>
        </div>
      )}

      {/* Turn Indicator */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
        <div className="px-6 py-3 bg-slate-800/90 rounded-full border border-slate-600">
          <p className="text-white text-center">
            {gameState.players[gameState.currentPlayerIndex]?.username}'s Turn
          </p>
          <p className="text-slate-400 text-sm text-center capitalize">
            {gameState.phase.replace(/_/g, ' ')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrollopolyGame;
