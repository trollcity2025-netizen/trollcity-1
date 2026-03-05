// TrollopolyCityBoard.tsx - Immersive 3D Mini City Board Game
// Complete revamp with real-time sky, city streets, property buildings, vehicles, and visual polish

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TrollopolyGameState, TrollopolyPlayer, Property } from '@/lib/game/types/TrollopolyTypes';
import { GameAction } from '@/lib/game/InternetGameTypes';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { 
  Video, VideoOff, Mic, MicOff, 
  Eye, MessageSquare, Send,
  Dice5, Home, Coins, Moon, Sun, Building2
} from 'lucide-react';

// Vehicle colors for each player
const VEHICLE_COLORS = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
const VEHICLE_EMISSIVE = ['#ff0000', '#0000ff', '#00ff00', '#ffff00'];

// Board layout constants
const BOARD_SIZE = 24; // Total board width/depth
const ROAD_WIDTH = 3.5;
const SIDEWALK_WIDTH = 1.5;
const TILE_SIZE = 1.8;
const CORNER_TILE_SIZE = 2.8;
const ROAD_RADIUS = BOARD_SIZE / 2;

// Sky colors for day/night
const SKY_CONFIG = {
  day: {
    background: 0x87CEEB,
    fog: 0x87CEEB,
    ambientIntensity: 0.6,
    sunIntensity: 1.2,
    sunColor: 0xffffff,
  },
  night: {
    background: 0x0a0a1a,
    fog: 0x0a0a1a,
    ambientIntensity: 0.2,
    sunIntensity: 0.1,
    sunColor: 0x4444ff,
  },
};

interface TrollopolyCityBoardProps {
  gameState: TrollopolyGameState;
  playerId: string;
  onAction: (action: GameAction) => void;
  isHost: boolean;
  isSpectator?: boolean;
  streamId?: string;
}

// Calculate position on road path for a given tile index (0-39)
const getRoadPosition = (tileIndex: number): { x: number; z: number; rotation: number } => {
  const tilesPerSide = 10;
  const roadOffset = ROAD_RADIUS - ROAD_WIDTH / 2;
  
  // Determine which side of the board (0=bottom, 1=left, 2=top, 3=right)
  const side = Math.floor(tileIndex / tilesPerSide);
  const indexOnSide = tileIndex % tilesPerSide;
  
  // Calculate position along each side
  const sideLength = BOARD_SIZE - 2 * CORNER_TILE_SIZE;
  const step = sideLength / (tilesPerSide - 1);
  
  switch (side) {
    case 0: // Bottom side (GO to Jail) - right to left
      return {
        x: roadOffset - CORNER_TILE_SIZE - indexOnSide * step,
        z: roadOffset,
        rotation: Math.PI / 2,
      };
    case 1: // Left side (Jail to Free Parking) - bottom to top
      return {
        x: -roadOffset,
        z: roadOffset - CORNER_TILE_SIZE - indexOnSide * step,
        rotation: Math.PI,
      };
    case 2: // Top side (Free Parking to Go To Jail) - left to right
      return {
        x: -roadOffset + CORNER_TILE_SIZE + indexOnSide * step,
        z: -roadOffset,
        rotation: -Math.PI / 2,
      };
    case 3: // Right side (Go To Jail to GO) - top to bottom
      return {
        x: roadOffset,
        z: -roadOffset + CORNER_TILE_SIZE + indexOnSide * step,
        rotation: 0,
      };
    default:
      return { x: 0, z: 0, rotation: 0 };
  }
};

// Get corner position
const getCornerPosition = (cornerIndex: number): { x: number; z: number } => {
  const offset = ROAD_RADIUS - ROAD_WIDTH / 2;
  switch (cornerIndex) {
    case 0: return { x: offset, z: offset }; // GO (bottom right)
    case 1: return { x: -offset, z: offset }; // Jail (bottom left)
    case 2: return { x: -offset, z: -offset }; // Free Parking (top left)
    case 3: return { x: offset, z: -offset }; // Go To Jail (top right)
    default: return { x: 0, z: 0 };
  }
};

export const TrollopolyCityBoard: React.FC<TrollopolyCityBoardProps> = ({
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
  const tileLabelsRef = useRef<Map<number, THREE.Group>>(new Map());
  const highlightedTileRef = useRef<number | null>(null);
  const diceRef = useRef<{ die1: THREE.Mesh; die2: THREE.Mesh; group: THREE.Group } | null>(null);
  const moonRef = useRef<THREE.Mesh | null>(null);
  const sunRef = useRef<THREE.Mesh | null>(null);
  const jailLightsRef = useRef<THREE.PointLight[]>([]);
  const animationFrameRef = useRef<number>();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [cameraStates, setCameraStates] = useState<Map<string, { enabled: boolean; muted: boolean }>>(new Map());
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null);
  const [isDayTime, setIsDayTime] = useState(true);
  const [playerBalances, setPlayerBalances] = useState<Map<string, number>>(new Map());
  const [movingVehicle, setMovingVehicle] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isCurrentTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId && !isSpectator;

  const determineTimeOfDay = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 6 && hours < 18;
  }, []);

  const { messages, sendMessage } = useStreamChat({
    streamId: streamId || gameState.matchId,
    hostId: gameState.players[0]?.id || '',
    isHost: isHost,
  });

  // Fetch player balances
  useEffect(() => {
    const fetchBalances = async () => {
      const balances = new Map<string, number>();
      for (const player of gameState.players) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('troll_coins')
            .eq('id', player.id)
            .single();
          if (data) balances.set(player.id, data.troll_coins || 0);
        } catch (err) {
          console.error('Failed to fetch balance for player:', player.id);
        }
      }
      setPlayerBalances(balances);
    };
    fetchBalances();
  }, [gameState.players]);

  // Initialize 3D scene
  useEffect(() => {
    if (!mountRef.current) return;

    const isDay = determineTimeOfDay();
    setIsDayTime(isDay);
    const skyConfig = isDay ? SKY_CONFIG.day : SKY_CONFIG.night;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(skyConfig.background);
    scene.fog = new THREE.Fog(skyConfig.fog, 40, 120);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(35, 40, 35);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 25;
    controls.maxDistance = 80;
    controlsRef.current = controls;

    setupLighting(scene, isDay);
    createCityBoard(scene);
    createCenterDice(scene);

    gameState.players.forEach((player, index) => {
      createVehicle(scene, player, index);
    });

    let time = 0;
    const animate = () => {
      time += 0.016;
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (jailLightsRef.current.length > 0) {
        jailLightsRef.current[0].intensity = 2 + Math.sin(time * 5) * 1.5;
        jailLightsRef.current[1].intensity = 2 + Math.cos(time * 5) * 1.5;
      }

      if (moonRef.current && !isDay) moonRef.current.rotation.y += 0.001;
      if (sunRef.current && isDay) sunRef.current.rotation.y += 0.001;

      // Animate dice if rolling
      if (diceRef.current && gameState.dice.isRolling) {
        diceRef.current.die1.rotation.x += 0.4;
        diceRef.current.die1.rotation.z += 0.3;
        diceRef.current.die2.rotation.y += 0.35;
        diceRef.current.die2.rotation.x -= 0.25;
        // Float animation
        diceRef.current.group.position.y = 3 + Math.sin(time * 3) * 0.3;
      } else if (diceRef.current) {
        // Set final dice rotation
        setDiceRotation(diceRef.current.die1, gameState.dice.die1);
        setDiceRotation(diceRef.current.die2, gameState.dice.die2);
        diceRef.current.group.position.y = 3;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const setupLighting = (scene: THREE.Scene, isDay: boolean) => {
    const config = isDay ? SKY_CONFIG.day : SKY_CONFIG.night;

    const ambientLight = new THREE.AmbientLight(0xffffff, config.ambientIntensity);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(config.sunColor, config.sunIntensity);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    scene.add(sunLight);

    if (!isDay) {
      const moonGeometry = new THREE.SphereGeometry(2, 32, 32);
      const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xffffdd, emissive: 0xffffdd, emissiveIntensity: 0.5 });
      const moon = new THREE.Mesh(moonGeometry, moonMaterial);
      moon.position.set(25, 50, -25);
      scene.add(moon);
      moonRef.current = moon;

      const cityGlow = new THREE.AmbientLight(0x4444ff, 0.15);
      scene.add(cityGlow);
    } else {
      const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa, emissive: 0xffaa00, emissiveIntensity: 0.8 });
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.position.set(25, 50, -25);
      scene.add(sun);
      sunRef.current = sun;
    }
  };

  const createCityBoard = (scene: THREE.Scene) => {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(80, 80);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create the board
    createRoads(scene);
    createSidewalks(scene);
    createTiles(scene);
    createProperties(scene);
    createCornerTiles(scene);
    createBackgroundCity(scene);
    createStreetLights(scene);
    createCenterCity(scene);
  };

  const createRoads = (scene: THREE.Scene) => {
    const asphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 });
    const whiteLineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    // Create roads on all four sides
    const sideLength = BOARD_SIZE - 2 * CORNER_TILE_SIZE;
    
    // Bottom road
    const bottomRoad = new THREE.Mesh(new THREE.PlaneGeometry(sideLength, ROAD_WIDTH), asphaltMaterial);
    bottomRoad.rotation.x = -Math.PI / 2;
    bottomRoad.position.set(0, 0.01, ROAD_RADIUS - ROAD_WIDTH / 2);
    scene.add(bottomRoad);

    // Top road
    const topRoad = new THREE.Mesh(new THREE.PlaneGeometry(sideLength, ROAD_WIDTH), asphaltMaterial);
    topRoad.rotation.x = -Math.PI / 2;
    topRoad.position.set(0, 0.01, -ROAD_RADIUS + ROAD_WIDTH / 2);
    scene.add(topRoad);

    // Left road
    const leftRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, sideLength), asphaltMaterial);
    leftRoad.rotation.x = -Math.PI / 2;
    leftRoad.position.set(-ROAD_RADIUS + ROAD_WIDTH / 2, 0.01, 0);
    scene.add(leftRoad);

    // Right road
    const rightRoad = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, sideLength), asphaltMaterial);
    rightRoad.rotation.x = -Math.PI / 2;
    rightRoad.position.set(ROAD_RADIUS - ROAD_WIDTH / 2, 0.01, 0);
    scene.add(rightRoad);

    // Corner road intersections
    const cornerSize = ROAD_WIDTH;
    const corners = [
      { x: ROAD_RADIUS - ROAD_WIDTH / 2, z: ROAD_RADIUS - ROAD_WIDTH / 2 },
      { x: -ROAD_RADIUS + ROAD_WIDTH / 2, z: ROAD_RADIUS - ROAD_WIDTH / 2 },
      { x: -ROAD_RADIUS + ROAD_WIDTH / 2, z: -ROAD_RADIUS + ROAD_WIDTH / 2 },
      { x: ROAD_RADIUS - ROAD_WIDTH / 2, z: -ROAD_RADIUS + ROAD_WIDTH / 2 },
    ];
    
    corners.forEach(corner => {
      const intersection = new THREE.Mesh(new THREE.PlaneGeometry(cornerSize, cornerSize), asphaltMaterial);
      intersection.rotation.x = -Math.PI / 2;
      intersection.position.set(corner.x, 0.01, corner.z);
      scene.add(intersection);
    });

    // Lane dividers
    for (let i = 0; i < 8; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), lineMaterial);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(-sideLength / 2 + i * (sideLength / 7), 0.02, ROAD_RADIUS - ROAD_WIDTH / 2);
      scene.add(dash);

      const topDash = dash.clone();
      topDash.position.set(-sideLength / 2 + i * (sideLength / 7), 0.02, -ROAD_RADIUS + ROAD_WIDTH / 2);
      scene.add(topDash);

      const leftDash = dash.clone();
      leftDash.rotation.z = Math.PI / 2;
      leftDash.position.set(-ROAD_RADIUS + ROAD_WIDTH / 2, 0.02, -sideLength / 2 + i * (sideLength / 7));
      scene.add(leftDash);

      const rightDash = dash.clone();
      rightDash.rotation.z = Math.PI / 2;
      rightDash.position.set(ROAD_RADIUS - ROAD_WIDTH / 2, 0.02, -sideLength / 2 + i * (sideLength / 7));
      scene.add(rightDash);
    }

    // Edge lines
    const edgeOffset = ROAD_WIDTH / 2 - 0.15;
    [-edgeOffset, edgeOffset].forEach(offset => {
      const bottomEdge = new THREE.Mesh(new THREE.PlaneGeometry(sideLength, 0.1), whiteLineMaterial);
      bottomEdge.rotation.x = -Math.PI / 2;
      bottomEdge.position.set(0, 0.02, ROAD_RADIUS - ROAD_WIDTH / 2 + offset);
      scene.add(bottomEdge);

      const topEdge = bottomEdge.clone();
      topEdge.position.set(0, 0.02, -ROAD_RADIUS + ROAD_WIDTH / 2 + offset);
      scene.add(topEdge);

      const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(0.1, sideLength), whiteLineMaterial);
      leftEdge.rotation.x = -Math.PI / 2;
      leftEdge.position.set(-ROAD_RADIUS + ROAD_WIDTH / 2 + offset, 0.02, 0);
      scene.add(leftEdge);

      const rightEdge = leftEdge.clone();
      rightEdge.position.set(ROAD_RADIUS - ROAD_WIDTH / 2 + offset, 0.02, 0);
      scene.add(rightEdge);
    });
  };

  const createSidewalks = (scene: THREE.Scene) => {
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });
    const sideLength = BOARD_SIZE - 2 * CORNER_TILE_SIZE - 0.2;
    const sidewalkOffset = ROAD_RADIUS - ROAD_WIDTH - SIDEWALK_WIDTH / 2;

    // Bottom sidewalk
    const bottomWalk = new THREE.Mesh(new THREE.BoxGeometry(sideLength, 0.2, SIDEWALK_WIDTH), sidewalkMaterial);
    bottomWalk.position.set(0, 0.1, sidewalkOffset);
    scene.add(bottomWalk);

    // Top sidewalk
    const topWalk = new THREE.Mesh(new THREE.BoxGeometry(sideLength, 0.2, SIDEWALK_WIDTH), sidewalkMaterial);
    topWalk.position.set(0, 0.1, -sidewalkOffset);
    scene.add(topWalk);

    // Left sidewalk
    const leftWalk = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK_WIDTH, 0.2, sideLength), sidewalkMaterial);
    leftWalk.position.set(-sidewalkOffset, 0.1, 0);
    scene.add(leftWalk);

    // Right sidewalk
    const rightWalk = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK_WIDTH, 0.2, sideLength), sidewalkMaterial);
    rightWalk.position.set(sidewalkOffset, 0.1, 0);
    scene.add(rightWalk);
  };

  const createTiles = (scene: THREE.Scene) => {
    gameState.properties.forEach((property, index) => {
      if (property.type === 'special' && [0, 10, 20, 30].includes(index)) return; // Skip corners
      
      const pos = getRoadPosition(index);
      const group = new THREE.Group();

      // Tile base
      const tileGeometry = new THREE.BoxGeometry(TILE_SIZE, 0.15, TILE_SIZE);
      const tileMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdddddd,
        roughness: 0.6,
      });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);
      tile.position.y = 0.075;
      tile.receiveShadow = true;
      group.add(tile);

      // Color strip for properties
      if (property.type !== 'special') {
        const stripGeometry = new THREE.BoxGeometry(TILE_SIZE - 0.1, 0.05, 0.3);
        const stripMaterial = new THREE.MeshStandardMaterial({ 
          color: property.color,
          emissive: property.color,
          emissiveIntensity: 0.2,
        });
        const strip = new THREE.Mesh(stripGeometry, stripMaterial);
        strip.position.y = 0.16;
        
        // Position strip based on side
        if (index < 10) strip.position.z = -TILE_SIZE / 2 + 0.2; // Bottom
        else if (index < 20) strip.position.x = TILE_SIZE / 2 - 0.2; // Left
        else if (index < 30) strip.position.z = TILE_SIZE / 2 - 0.2; // Top
        else strip.position.x = -TILE_SIZE / 2 + 0.2; // Right
        
        group.add(strip);
      }

      // Tile border
      const borderGeometry = new THREE.BoxGeometry(TILE_SIZE + 0.05, 0.02, TILE_SIZE + 0.05);
      const borderMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      border.position.y = 0.01;
      group.add(border);

      // Position tile on the road edge
      group.position.set(pos.x, 0, pos.z);
      group.rotation.y = pos.rotation;
      scene.add(group);
      tileLabelsRef.current.set(index, group);
    });
  };

  const createCornerTiles = (scene: THREE.Scene) => {
    const cornerIndices = [0, 10, 20, 30];
    const cornerNames = ['GO', 'JAIL', 'FREE\nPARKING', 'GO TO\nJAIL'];
    
    cornerIndices.forEach((index, i) => {
      const pos = getCornerPosition(i);
      const property = gameState.properties[index];
      const group = new THREE.Group();

      // Large corner tile
      const tileGeometry = new THREE.BoxGeometry(CORNER_TILE_SIZE, 0.15, CORNER_TILE_SIZE);
      const tileMaterial = new THREE.MeshStandardMaterial({ 
        color: i === 0 ? 0xffd700 : i === 1 ? 0x444444 : i === 2 ? 0x228b22 : 0xdc143c,
        roughness: 0.5,
        metalness: i === 0 ? 0.6 : 0.1,
      });
      const tile = new THREE.Mesh(tileGeometry, tileMaterial);
      tile.position.y = 0.075;
      tile.receiveShadow = true;
      group.add(tile);

      // Border
      const borderGeometry = new THREE.BoxGeometry(CORNER_TILE_SIZE + 0.05, 0.02, CORNER_TILE_SIZE + 0.05);
      const borderMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      border.position.y = 0.01;
      group.add(border);

      group.position.set(pos.x, 0, pos.z);
      scene.add(group);
      tileLabelsRef.current.set(index, group);
    });
  };

  const createProperties = (scene: THREE.Scene) => {
    gameState.properties.forEach((property, index) => {
      if (property.type === 'special') {
        if (index === 10) createJailBuilding(scene, property, index);
        return;
      }

      const pos = getRoadPosition(index);
      const group = new THREE.Group();

      // Determine tier
      let tier: 'low' | 'mid' | 'high';
      if (property.price < 150) tier = 'low';
      else if (property.price < 300) tier = 'mid';
      else tier = 'high';

      // Building offset from sidewalk
      const buildingOffset = SIDEWALK_WIDTH / 2 + 0.8;
      
      // Base
      const baseGeometry = new THREE.BoxGeometry(1.6, 0.15, 1.6);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.y = 0.075;
      base.castShadow = true;
      group.add(base);

      // Building based on tier
      if (tier === 'low') {
        createHouseBuilding(group, property);
      } else if (tier === 'mid') {
        createApartmentBuilding(group, property);
      } else {
        createSkyscraperBuilding(group, property);
      }

      // Position building behind sidewalk
      let bx = pos.x;
      let bz = pos.z;
      
      if (index < 10) bz += buildingOffset; // Bottom
      else if (index < 20) bx += buildingOffset; // Left
      else if (index < 30) bz -= buildingOffset; // Top
      else bx -= buildingOffset; // Right

      group.position.set(bx, 0, bz);
      
      // Face inward
      if (index < 10) group.rotation.y = 0;
      else if (index < 20) group.rotation.y = -Math.PI / 2;
      else if (index < 30) group.rotation.y = Math.PI;
      else group.rotation.y = Math.PI / 2;
      
      scene.add(group);
      buildingsRef.current.set(index, group);
    });
  };

  const createHouseBuilding = (group: THREE.Group, property: Property) => {
    const houseHeight = 1.4;
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, houseHeight, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xccaa88, roughness: 0.7 })
    );
    house.position.y = houseHeight / 2 + 0.15;
    house.castShadow = true;
    group.add(house);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    roof.position.y = houseHeight + 0.4;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.6, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x4a3728 })
    );
    door.position.set(0, 0.45, 0.47);
    group.add(door);

    // Windows with glow
    const windowMat = new THREE.MeshStandardMaterial({ 
      color: 0x87ceeb, 
      emissive: 0x87ceeb, 
      emissiveIntensity: 0.3 
    });
    [-0.35, 0.35].forEach(x => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.3), windowMat);
      win.position.set(x, 0.9, 0.46);
      group.add(win);
    });
  };

  const createApartmentBuilding = (group: THREE.Group, property: Property) => {
    const floors = 4;
    const floorHeight = 0.7;
    
    for (let i = 0; i < floors; i++) {
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, floorHeight, 1),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xbbbbbb : 0x999999 })
      );
      floor.position.y = 0.15 + floorHeight / 2 + i * floorHeight;
      floor.castShadow = true;
      group.add(floor);

      // Windows
      const windowMat = new THREE.MeshStandardMaterial({ 
        color: 0x87ceeb, 
        emissive: 0x87ceeb, 
        emissiveIntensity: 0.25 
      });
      [-0.3, 0.3].forEach(x => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.4), windowMat);
        win.position.set(x, 0.15 + floorHeight / 2 + i * floorHeight, 0.51);
        group.add(win);
      });
    }
  };

  const createSkyscraperBuilding = (group: THREE.Group, property: Property) => {
    const floors = 7;
    const floorHeight = 0.6;

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, floors * floorHeight, 1.1),
      new THREE.MeshStandardMaterial({ 
        color: property.color,
        roughness: 0.1,
        metalness: 0.7,
        transparent: true,
        opacity: 0.9,
      })
    );
    building.position.y = 0.15 + (floors * floorHeight) / 2;
    building.castShadow = true;
    group.add(building);

    // Window grid
    const windowMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      emissive: 0xffffff, 
      emissiveIntensity: 0.4 
    });
    for (let f = 0; f < floors; f++) {
      [-0.3, 0.3].forEach(x => {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.35), windowMat);
        win.position.set(x, 0.4 + f * floorHeight, 0.56);
        group.add(win);
      });
    }

    // Spire
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 })
    );
    spire.position.y = 0.15 + floors * floorHeight + 0.6;
    group.add(spire);
  };

  const createJailBuilding = (scene: THREE.Scene, property: Property, index: number) => {
    const pos = getCornerPosition(1);
    const group = new THREE.Group();

    // Main building
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    building.position.y = 1.25;
    building.castShadow = true;
    group.add(building);

    // Bars
    const barMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2), barMat);
      bar.position.set(-0.7 + i * 0.23, 1.2, 1.12);
      group.add(bar);
    }

    // Police sign
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 0.4 })
    );
    sign.position.set(0, 2.8, 0);
    group.add(sign);

    // Flashing lights
    const redLight = new THREE.PointLight(0xff0000, 0, 10);
    redLight.position.set(-0.6, 3.2, 0);
    group.add(redLight);
    jailLightsRef.current.push(redLight);

    const blueLight = new THREE.PointLight(0x0000ff, 0, 10);
    blueLight.position.set(0.6, 3.2, 0);
    group.add(blueLight);
    jailLightsRef.current.push(blueLight);

    // Light fixtures
    const redFix = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redFix.position.copy(redLight.position);
    group.add(redFix);

    const blueFix = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    blueFix.position.copy(blueLight.position);
    group.add(blueFix);

    group.position.set(pos.x, 0, pos.z);
    scene.add(group);
    buildingsRef.current.set(index, group);
  };

  const createCenterDice = (scene: THREE.Scene) => {
    const group = new THREE.Group();
    
    // Dice platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.2, 0.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x4a4a6e, metalness: 0.3 })
    );
    platform.position.y = 0.1;
    platform.receiveShadow = true;
    group.add(platform);

    // Dice
    const dieGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const dieMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    const die1 = new THREE.Mesh(dieGeometry, dieMaterial);
    die1.position.set(-0.5, 3, 0);
    die1.castShadow = true;
    group.add(die1);

    const die2 = new THREE.Mesh(dieGeometry, dieMaterial);
    die2.position.set(0.5, 3, 0);
    die2.castShadow = true;
    group.add(die2);

    // Add dots
    addDiceDots(die1);
    addDiceDots(die2);

    diceRef.current = { die1, die2, group };
    scene.add(group);
  };

  const addDiceDots = (die: THREE.Mesh) => {
    const dotGeo = new THREE.CircleGeometry(0.06, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const configs = [
      { normal: [0, 0, 1], positions: [[0, 0]] },
      { normal: [0, 0, -1], positions: [[-0.15, -0.15], [0.15, 0.15]] },
      { normal: [1, 0, 0], positions: [[-0.15, 0.15], [0, 0], [0.15, -0.15]] },
      { normal: [-1, 0, 0], positions: [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]] },
      { normal: [0, 1, 0], positions: [[-0.15, -0.15], [0.15, -0.15], [0, 0], [-0.15, 0.15], [0.15, 0.15]] },
      { normal: [0, -1, 0], positions: [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0], [0.15, 0], [-0.15, 0.15], [0.15, 0.15]] },
    ];

    configs.forEach(face => {
      face.positions.forEach(pos => {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const offset = 0.301;
        if (face.normal[0] !== 0) {
          dot.position.set(face.normal[0] * offset, pos[1], pos[0]);
          dot.rotation.y = face.normal[0] > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else if (face.normal[1] !== 0) {
          dot.position.set(pos[0], face.normal[1] * offset, pos[1]);
          dot.rotation.x = face.normal[1] > 0 ? -Math.PI / 2 : Math.PI / 2;
        } else {
          dot.position.set(pos[0], pos[1], face.normal[2] * offset);
          if (face.normal[2] < 0) dot.rotation.y = Math.PI;
        }
        die.add(dot);
      });
    });
  };

  const setDiceRotation = (die: THREE.Mesh, value: number) => {
    const rots: Record<number, { x: number; y: number; z: number }> = {
      1: { x: 0, y: 0, z: 0 },
      2: { x: Math.PI, y: 0, z: 0 },
      3: { x: 0, y: -Math.PI / 2, z: 0 },
      4: { x: 0, y: Math.PI / 2, z: 0 },
      5: { x: -Math.PI / 2, y: 0, z: 0 },
      6: { x: Math.PI / 2, y: 0, z: 0 },
    };
    const r = rots[value] || rots[1];
    die.rotation.set(r.x, r.y, r.z);
  };

  const createVehicle = (scene: THREE.Scene, player: TrollopolyPlayer, index: number) => {
    const group = new THREE.Group();
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    // Car body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.3, 1.2),
      new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 })
    );
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    cabin.position.y = 0.55;
    group.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    [[-0.32, 0.4], [0.32, 0.4], [-0.32, -0.4], [0.32, -0.4]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.12, z);
      group.add(wheel);
    });

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    [-0.18, 0.18].forEach(x => {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.06), lightMat);
      light.position.set(x, 0.3, 0.62);
      group.add(light);
    });

    // Position at GO corner with offset
    const startPos = getRoadPosition(0);
    const laneOffset = 0.6;
    const sideOffset = (index % 2) * 0.8 - 0.4;
    
    group.position.set(
      startPos.x + sideOffset,
      0,
      startPos.z + laneOffset
    );
    group.rotation.y = Math.PI / 2;

    scene.add(group);
    vehiclesRef.current.set(player.id, group);
  };

  // Vehicle movement along road path
  const moveVehicleAlongRoad = (playerId: string, fromTile: number, toTile: number) => {
    const vehicle = vehiclesRef.current.get(playerId);
    if (!vehicle) return;

    const playerIndex = gameState.players.findIndex(p => p.id === playerId);
    const laneOffset = 0.6;
    const sideOffset = (playerIndex % 2) * 0.8 - 0.4;

    // Calculate path points
    const path: { x: number; z: number; rot: number }[] = [];
    let current = fromTile;
    
    while (current !== toTile) {
      current = (current + 1) % 40;
      const pos = getRoadPosition(current);
      
      // Add lane and side offset
      let x = pos.x;
      let z = pos.z;
      
      // Adjust for lane (outer lane)
      if (current < 10) z += laneOffset;
      else if (current < 20) x += laneOffset;
      else if (current < 30) z -= laneOffset;
      else x -= laneOffset;
      
      // Add side offset for multiple vehicles
      if (current < 10) x += sideOffset;
      else if (current < 20) z += sideOffset;
      else if (current < 30) x -= sideOffset;
      else z -= sideOffset;
      
      path.push({ x, z, rot: pos.rotation });
    }

    setMovingVehicle(playerId);
    
    // Animate through path
    let stepIndex = 0;
    const moveStep = () => {
      if (stepIndex >= path.length) {
        setMovingVehicle(null);
        return;
      }

      const target = path[stepIndex];
      const startX = vehicle.position.x;
      const startZ = vehicle.position.z;
      const startTime = Date.now();
      const duration = 300; // ms per tile

      const animateStep = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        vehicle.position.x = startX + (target.x - startX) * ease;
        vehicle.position.z = startZ + (target.z - startZ) * ease;
        vehicle.rotation.y = target.rot;

        if (progress < 1) {
          requestAnimationFrame(animateStep);
        } else {
          stepIndex++;
          moveStep();
        }
      };
      animateStep();
    };
    moveStep();
  };

  // Update vehicle positions
  useEffect(() => {
    if (!sceneRef.current) return;

    gameState.players.forEach((player) => {
      if (player.position !== undefined) {
        moveVehicleAlongRoad(player.id, player.position - 1 < 0 ? 39 : player.position - 1, player.position);
      }
    });
  }, [gameState.players.map(p => p.position).join(',')]);

  // Highlight current tile
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer && highlightedTileRef.current !== null) {
      // Remove previous highlight
      const prevTile = tileLabelsRef.current.get(highlightedTileRef.current);
      if (prevTile) {
        prevTile.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = child.material.emissiveIntensity / 3;
          }
        });
      }
    }

    if (currentPlayer) {
      setSelectedTile(currentPlayer.position);
      highlightedTileRef.current = currentPlayer.position;
      
      // Add highlight to current tile
      const tile = tileLabelsRef.current.get(currentPlayer.position);
      if (tile) {
        tile.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = child.material.emissiveIntensity * 3;
          }
        });
      }
    }
  }, [gameState.currentPlayerIndex, gameState.players]);

  const createBackgroundCity = (scene: THREE.Scene) => {
    const colors = [0x444444, 0x555555, 0x666666];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 25;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = 6 + Math.random() * 20;
      
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(4 + Math.random() * 4, h, 4 + Math.random() * 4),
        new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
      );
      building.position.set(x, h / 2, z);
      building.castShadow = true;
      scene.add(building);
    }
  };

  const createStreetLights = (scene: THREE.Scene) => {
    const positions = [
      { x: 10, z: 10 }, { x: -10, z: 10 },
      { x: -10, z: -10 }, { x: 10, z: -10 },
      { x: 0, z: 12 }, { x: 0, z: -12 },
      { x: 12, z: 0 }, { x: -12, z: 0 },
    ];

    positions.forEach(pos => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 5),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      pole.position.set(pos.x, 2.5, pos.z);
      scene.add(pole);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.15),
        new THREE.MeshBasicMaterial({ color: 0xffffaa })
      );
      bulb.position.set(pos.x + 0.3, 4.8, pos.z);
      scene.add(bulb);

      if (!isDayTime) {
        const light = new THREE.PointLight(0xffaa44, 1, 15);
        light.position.set(pos.x + 0.3, 4.5, pos.z);
        scene.add(light);
      }
    });
  };

  const createCenterCity = (scene: THREE.Scene) => {
    // Central park area
    const grass = new THREE.Mesh(
      new THREE.CircleGeometry(10, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a8c3a })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.02;
    scene.add(grass);

    // Fountain
    const fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.8, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    fountain.position.y = 0.15;
    scene.add(fountain);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.3, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x0099ff, transparent: true, opacity: 0.8 })
    );
    water.position.y = 0.3;
    scene.add(water);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    await sendMessage(chatMessage);
    setChatMessage('');
  };

  const handleRollDice = () => {
    if (!isCurrentTurn || gameState.phase !== 'waiting_for_roll' || movingVehicle) return;
    onAction({ type: 'roll_dice', payload: {}, timestamp: Date.now(), playerId });
  };

  const handleBuyProperty = () => {
    if (!isCurrentTurn) return;
    onAction({ type: 'buy_property', payload: {}, timestamp: Date.now(), playerId });
  };

  const toggleCamera = (targetPlayerId: string) => {
    setCameraStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(targetPlayerId) || { enabled: true, muted: false };
      newStates.set(targetPlayerId, { ...current, enabled: !current.enabled });
      return newStates;
    });
  };

  const toggleMute = (targetPlayerId: string) => {
    setCameraStates(prev => {
      const newStates = new Map(prev);
      const current = newStates.get(targetPlayerId) || { enabled: true, muted: false };
      newStates.set(targetPlayerId, { ...current, muted: !current.muted });
      return newStates;
    });
  };

  const getCornerStyles = (index: number) => {
    const corners = ['top-4 left-4', 'top-4 right-4', 'bottom-4 left-4', 'bottom-4 right-4'];
    return corners[index % 4];
  };

  // Get current property for display
  const currentProperty = currentPlayer ? gameState.properties[currentPlayer.position] : null;

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" style={{ cursor: 'grab' }} />

      {/* Day/Night Indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-full border border-slate-600">
          {isDayTime ? (
            <><Sun size={18} className="text-yellow-400" /><span className="text-white text-sm font-medium">Day</span></>
          ) : (
            <><Moon size={18} className="text-blue-400" /><span className="text-white text-sm font-medium">Night</span></>
          )}
        </div>
      </div>

      {/* Player Cameras */}
      {gameState.players.map((player, index) => {
        const cameraState = cameraStates.get(player.id) || { enabled: true, muted: false };
        const isHighlighted = highlightedPlayer === player.id;
        const realBalance = playerBalances.get(player.id) || player.coins;
        
        return (
          <div key={player.id} className={`absolute ${getCornerStyles(index)} z-20 transition-all duration-300`}>
            <div className={`relative bg-slate-800 rounded-xl overflow-hidden border-2 ${isHighlighted ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-slate-600'} transition-all duration-300`} style={{ width: '220px', height: '165px' }}>
              <div className="relative w-full h-full bg-black">
                {player.id === playerId && cameraState.enabled ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-slate-800">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: VEHICLE_COLORS[index % VEHICLE_COLORS.length] }}>
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${player.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <p className="text-white text-sm font-medium truncate">{player.username} {player.id === playerId && '(You)'}</p>
                  <div className="flex items-center gap-2">
                    <Coins size={14} className="text-yellow-400" />
                    <p className="text-yellow-400 text-xs font-medium">{realBalance.toLocaleString()} TC</p>
                  </div>
                  <p className="text-slate-400 text-xs">🏠 {player.properties.length} Properties</p>
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <button onClick={() => toggleMute(player.id)} className={`p-1.5 rounded ${cameraState.muted ? 'bg-red-500/80' : 'bg-slate-700/80'} hover:opacity-80 transition-all`}>
                    {cameraState.muted ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                  <button onClick={() => toggleCamera(player.id)} className={`p-1.5 rounded ${!cameraState.enabled ? 'bg-red-500/80' : 'bg-slate-700/80'} hover:opacity-80 transition-all`}>
                    {!cameraState.enabled ? <VideoOff size={14} /> : <Video size={14} />}
                  </button>
                </div>
                {gameState.currentPlayerIndex === index && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 rounded-full text-xs text-white font-bold shadow-lg">YOUR TURN</div>
                )}
                {player.isBankrupt && (
                  <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">BANKRUPT</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Spectator Count */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-full border border-slate-600">
          <Eye size={18} className="text-slate-400" />
          <span className="text-white font-medium">{gameState.spectatorCount} watching</span>
        </div>
      </div>

      {/* Game Controls */}
      {!isSpectator && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {isCurrentTurn && gameState.phase === 'waiting_for_roll' && (
            <button onClick={handleRollDice} disabled={movingVehicle !== null} className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
              <Dice5 size={28} />
              {movingVehicle ? 'Moving...' : 'Roll Dice'}
            </button>
          )}
          
          {isCurrentTurn && gameState.phase === 'property_action' && (
            <>
              <button onClick={handleBuyProperty} className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all hover:scale-105">
                <Building2 size={24} />
                Buy Property
              </button>
              <button onClick={() => onAction({ type: 'end_turn', payload: {}, timestamp: Date.now(), playerId })} className="flex items-center gap-2 px-6 py-4 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl transition-all">
                Skip
              </button>
            </>
          )}

          {isCurrentTurn && gameState.phase === 'jail' && (
            <>
              <button onClick={() => onAction({ type: 'pay_jail_fine', payload: {}, timestamp: Date.now(), playerId })} className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold rounded-xl shadow-lg">
                <Coins size={20} />
                Pay 50 TC
              </button>
              {currentPlayer?.hasGetOutOfJailFree && (
                <button onClick={() => onAction({ type: 'use_jail_card', payload: {}, timestamp: Date.now(), playerId })} className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold rounded-xl shadow-lg">
                  Use Card
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${showChat ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-80 bg-slate-800/95 rounded-xl border border-slate-600 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between p-3 bg-slate-700/50 border-b border-slate-600">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-slate-400" />
              <span className="text-white font-medium">Game Chat</span>
            </div>
            <button onClick={() => setShowChat(!showChat)} className="p-1 hover:bg-slate-600 rounded text-slate-400 hover:text-white">×</button>
          </div>
          <div className="h-64 overflow-y-auto p-3 space-y-2">
            {messages.slice(-20).map((msg) => (
              <div key={msg.id} className={`text-sm ${msg.type === 'system' ? 'text-yellow-400 italic' : 'text-slate-200'}`}>
                {msg.type === 'system' ? <span>{msg.content}</span> : <><span className="font-medium text-blue-400">{msg.sender_name}: </span><span>{msg.content}</span></>}
              </div>
            ))}
            {gameState.gameLog.slice(-5).map((log) => (
              <div key={log.id} className="text-xs text-slate-400 italic">{log.message}</div>
            ))}
          </div>
          <form onSubmit={handleSendChat} className="p-3 border-t border-slate-600">
            <div className="flex gap-2">
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 bg-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"><Send size={16} /></button>
            </div>
          </form>
        </div>
      </div>

      {!showChat && (
        <button onClick={() => setShowChat(true)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-600 text-white transition-all shadow-lg">
          <MessageSquare size={20} />
        </button>
      )}

      {/* Property Info Panel */}
      {currentProperty && (
        <div className="absolute bottom-6 right-6 z-20">
          <div className="bg-slate-800/95 rounded-xl border border-slate-600 p-4 w-72 shadow-xl">
            <h3 className="text-white font-bold mb-2 flex items-center gap-2">
              <Home size={18} className="text-blue-400" />
              Current Space
            </h3>
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">{currentProperty.name}</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentProperty.color }} />
                <p className="text-sm text-slate-400 capitalize">{currentProperty.type}</p>
              </div>
              {currentProperty.price > 0 && (
                <p className="text-yellow-400 font-medium">💰 Price: {currentProperty.price.toLocaleString()} TC</p>
              )}
              {currentProperty.ownerId && (
                <p className="text-sm text-slate-300">Owner: {gameState.players.find(p => p.id === currentProperty.ownerId)?.username}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dice Display */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 shadow-lg ${gameState.dice.isRolling ? 'animate-pulse' : ''}`}>
            {gameState.dice.die1}
          </div>
          <span className="text-2xl text-white font-bold">+</span>
          <div className={`w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 shadow-lg ${gameState.dice.isRolling ? 'animate-pulse' : ''}`}>
            {gameState.dice.die2}
          </div>
          <span className="text-2xl text-white font-bold">=</span>
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
            {gameState.dice.die1 + gameState.dice.die2}
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
        <div className="px-6 py-3 bg-slate-800/90 rounded-full border border-slate-600 shadow-lg">
          <p className="text-white text-center font-medium">{gameState.players[gameState.currentPlayerIndex]?.username}'s Turn</p>
          <p className="text-slate-400 text-sm text-center capitalize">{gameState.phase.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Controls Help */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="bg-slate-800/80 rounded-lg p-3 text-xs text-slate-400">
          <p>🖱️ Drag to rotate • 📜 Scroll to zoom</p>
        </div>
      </div>
    </div>
  );
};

export default TrollopolyCityBoard;
