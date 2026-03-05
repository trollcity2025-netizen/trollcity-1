// TrollopolyCityDevTest.tsx
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Moon, Sun, Dice5, RotateCcw, MessageSquare, Send, ShoppingCart, X } from 'lucide-react';

const BOARD_CONFIG = { size: 80, tileSize: 5.5, streetWidth: 8, sidewalkWidth: 2 };
const SKY_CONFIG = {
  day: { background: 0x87CEEB, fog: 0x87CEEB, ambientIntensity: 0.6, sunIntensity: 1.2 },
  night: { background: 0x0a0a1a, fog: 0x0a0a1a, ambientIntensity: 0.2, sunIntensity: 0.1 }
};

const VEHICLE_COLORS = [0xff3333, 0x3366ff, 0x33cc33, 0xffcc00];

const TROLLOPOLY_PROPERTIES = [
  { id: 0, name: 'GO', type: 'special', color: 0xffffff, price: 0 },
  { id: 1, name: 'Downtown Diner', type: 'property', color: 0x8b4513, price: 60 },
  { id: 2, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 3, name: 'Corner Cafe', type: 'property', color: 0x8b4513, price: 70 },
  { id: 4, name: 'City Tax', type: 'special', color: 0xcccccc, price: 0 },
  { id: 5, name: 'Metro Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 6, name: 'Sunset Suites', type: 'property', color: 0x87ceeb, price: 100 },
  { id: 7, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 8, name: 'Harbor View', type: 'property', color: 0x87ceeb, price: 120 },
  { id: 9, name: 'Bay Heights', type: 'property', color: 0x87ceeb, price: 140 },
  { id: 10, name: 'Troll Jail', type: 'special', color: 0x444444, price: 0 },
  { id: 11, name: 'Tech Plaza', type: 'property', color: 0xff69b4, price: 150 },
  { id: 12, name: 'Power Plant', type: 'utility', color: 0xffff00, price: 150 },
  { id: 13, name: 'Innovation Hub', type: 'property', color: 0xff69b4, price: 160 },
  { id: 14, name: 'Startup Street', type: 'property', color: 0xff69b4, price: 180 },
  { id: 15, name: 'Central Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 16, name: 'Parkside Manor', type: 'property', color: 0xffa500, price: 200 },
  { id: 17, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 18, name: 'Garden Villa', type: 'property', color: 0xffa500, price: 220 },
  { id: 19, name: 'Rose Residence', type: 'property', color: 0xffa500, price: 240 },
  { id: 20, name: 'Free Parking', type: 'special', color: 0x228b22, price: 0 },
  { id: 21, name: 'Golden Tower', type: 'property', color: 0xff0000, price: 260 },
  { id: 22, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 23, name: 'Diamond Plaza', type: 'property', color: 0xff0000, price: 280 },
  { id: 24, name: 'Platinum Place', type: 'property', color: 0xff0000, price: 300 },
  { id: 25, name: 'West Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 26, name: 'Royal Gardens', type: 'property', color: 0xffff00, price: 320 },
  { id: 27, name: 'Luxury Suites', type: 'property', color: 0xffff00, price: 340 },
  { id: 28, name: 'Water Works', type: 'utility', color: 0x00ffff, price: 150 },
  { id: 29, name: 'Imperial Estate', type: 'property', color: 0xffff00, price: 360 },
  { id: 30, name: 'Go To Jail', type: 'special', color: 0xdc143c, price: 0 },
  { id: 31, name: 'Troll Palace', type: 'property', color: 0x00ff00, price: 400 },
  { id: 32, name: 'Fortune Court', type: 'property', color: 0x00ff00, price: 420 },
  { id: 33, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 34, name: 'Crown Heights', type: 'property', color: 0x00ff00, price: 440 },
  { id: 35, name: 'North Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 36, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 37, name: 'Elite Towers', type: 'property', color: 0x4b0082, price: 500 },
  { id: 38, name: 'Luxury Tax', type: 'special', color: 0xffd700, price: 0 },
  { id: 39, name: 'City Penthouse', type: 'property', color: 0x4b0082, price: 600 }
];

const TEST_USERS = [
  { id: 'user-1', username: 'CryptoKing', color: VEHICLE_COLORS[0] },
  { id: 'user-2', username: 'MayorTroll', color: VEHICLE_COLORS[1] },
  { id: 'user-3', username: 'TycoonJane', color: VEHICLE_COLORS[2] },
  { id: 'user-4', username: 'PropertyPro', color: VEHICLE_COLORS[3] }
];

const calculateTilePosition = (index: number) => {
  const { size, tileSize, streetWidth, sidewalkWidth } = BOARD_CONFIG;
  const tilesPerSide = 10;
  const side = Math.floor(index / tilesPerSide);
  const posOnSide = index % tilesPerSide;
  const edge = size / 2 - streetWidth - sidewalkWidth - tileSize / 2;
  const offset = (posOnSide + 0.5) * tileSize - (tilesPerSide * tileSize) / 2;
  let x = 0, z = 0, rotation = 0;
  switch(side) {
    case 0: x = -offset; z = -edge; rotation = 0; break;
    case 1: x = edge; z = -offset; rotation = -Math.PI / 2; break;
    case 2: x = offset; z = edge; rotation = Math.PI; break;
    case 3: x = -edge; z = offset; rotation = Math.PI / 2; break;
  }
  return { x, z, rotation };
};

const getRoadPosition = (tileIndex: number, playerIndex: number) => {
  const { size, streetWidth } = BOARD_CONFIG;
  const tilesPerSide = 10;
  const side = Math.floor(tileIndex / tilesPerSide);
  const posOnSide = tileIndex % tilesPerSide;
  const roadOffset = size / 2 - streetWidth / 2;
  const laneOffset = (playerIndex % 2 === 0 ? -1 : 1) * 1.2;
  const spacing = (size - streetWidth * 2) / tilesPerSide;
  let x = 0, z = 0, rotation = 0;
  switch(side) {
    case 0: x = roadOffset - (posOnSide + 0.5) * spacing; z = -roadOffset + laneOffset; rotation = Math.PI / 2; break;
    case 1: x = roadOffset + laneOffset; z = -roadOffset + (posOnSide + 0.5) * spacing; rotation = Math.PI; break;
    case 2: x = -roadOffset + (posOnSide + 0.5) * spacing; z = roadOffset + laneOffset; rotation = -Math.PI / 2; break;
    case 3: x = -roadOffset + laneOffset; z = roadOffset - (posOnSide + 0.5) * spacing; rotation = 0; break;
  }
  return { x, z, rotation };
};

export default function TrollopolyCityDevTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vehiclesRef = useRef<Map<string, THREE.Group>>(new Map());
  const tilesRef = useRef<Map<number, THREE.Group>>(new Map());
  const diceRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number>();
  const diceVelocityRef = useRef<{x: number, y: number, z: number, rotX: number, rotY: number, rotZ: number}[]>([]);
  
  const [isDayTime, setIsDayTime] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceValues, setDiceValues] = useState({ die1: 1, die2: 1 });
  const [isRolling, setIsRolling] = useState(false);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [movingVehicle, setMovingVehicle] = useState<string | null>(null);
  const [playerPositions, setPlayerPositions] = useState<number[]>([0, 0, 0, 0]);
  const [playerCoins, setPlayerCoins] = useState<number[]>([1500, 1500, 1500, 1500]);
  const [chatMessages, setChatMessages] = useState<{user: string; msg: string; time: string}[]>([
    { user: 'System', msg: 'Welcome to Trollopoly City! Roll the dice to start.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<typeof TROLLOPOLY_PROPERTIES[0] | null>(null);
  const [showPropertyPopup, setShowPropertyPopup] = useState(false);
  const [jailedPlayers, setJailedPlayers] = useState<boolean[]>([false, false, false, false]);
  const [showJailAnimation, setShowJailAnimation] = useState(false);
  const [jailMessage, setJailMessage] = useState('');

  useEffect(() => {
    if (!mountRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) { setWebglError('WebGL is not supported.'); setIsLoading(false); return; }
    } catch (e) { setWebglError('WebGL detection failed.'); setIsLoading(false); return; }

    try {
      const skyConfig = isDayTime ? SKY_CONFIG.day : SKY_CONFIG.night;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(skyConfig.background);
      scene.fog = new THREE.Fog(skyConfig.fog, 60, 250);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
      camera.position.set(60, 70, 60);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      if (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      setIsLoading(false);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2.2;
      controls.minDistance = 40;
      controls.maxDistance = 150;
      controlsRef.current = controls;

      const config = isDayTime ? SKY_CONFIG.day : SKY_CONFIG.night;
      const ambientLight = new THREE.AmbientLight(0xffffff, config.ambientIntensity);
      scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xffffff, config.sunIntensity);
      sunLight.position.set(50, 80, 40);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 4096;
      sunLight.shadow.mapSize.height = 4096;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 300;
      sunLight.shadow.camera.left = -80;
      sunLight.shadow.camera.right = 80;
      sunLight.shadow.camera.top = 80;
      sunLight.shadow.camera.bottom = -80;
      scene.add(sunLight);

      if (!isDayTime) {
        const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffdd, emissive: 0xffffdd, emissiveIntensity: 0.5 }));
        moon.position.set(60, 100, -60);
        scene.add(moon);
        scene.add(new THREE.AmbientLight(0x4444ff, 0.15));
      }

      createCityBoard(scene);
      TEST_USERS.forEach((user, index) => createVehicle(scene, user, index));
      createCenterDecks(scene);

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        if (diceAnimating && diceRef.current.length === 2) animateDicePhysics();
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
        if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      };
    } catch (error) {
      console.error('Failed to initialize 3D scene:', error);
      setWebglError('Failed to initialize WebGL.');
      setIsLoading(false);
    }
  }, [isDayTime, diceAnimating]);

  const createCityBoard = (scene: THREE.Scene) => {
    const { size, streetWidth, sidewalkWidth } = BOARD_CONFIG;
    
    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size + 60, size + 60), new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads
    const roadLength = size - streetWidth;
    const asphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
    const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9 });
    const streets = [
      { x: 0, z: size/2 - streetWidth/2, rot: 0, len: roadLength },
      { x: 0, z: -(size/2 - streetWidth/2), rot: 0, len: roadLength },
      { x: size/2 - streetWidth/2, z: 0, rot: Math.PI/2, len: roadLength },
      { x: -(size/2 - streetWidth/2), z: 0, rot: Math.PI/2, len: roadLength }
    ];

    streets.forEach((street) => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(street.len, streetWidth), asphaltMaterial);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = street.rot;
      road.position.set(street.x, 0, street.z);
      road.receiveShadow = true;
      scene.add(road);

      const dashCount = 15;
      const dashLength = street.len / (dashCount * 2);
      for (let i = 0; i < dashCount; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(dashLength, 0.2), markingMaterial);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = street.rot;
        const offset = (i - dashCount/2 + 0.5) * (street.len / dashCount);
        if (street.rot === 0) dash.position.set(street.x + offset, 0.02, street.z);
        else dash.position.set(street.x, 0.02, street.z + offset);
        scene.add(dash);
      }
    });

    // Sidewalks
    const innerSize = size - streetWidth * 2 - sidewalkWidth * 2;
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });
    const swPositions = [
      { x: 0, z: size/2 - streetWidth - sidewalkWidth/2, w: innerSize, d: sidewalkWidth },
      { x: 0, z: -(size/2 - streetWidth - sidewalkWidth/2), w: innerSize, d: sidewalkWidth },
      { x: size/2 - streetWidth - sidewalkWidth/2, z: 0, w: sidewalkWidth, d: innerSize },
      { x: -(size/2 - streetWidth - sidewalkWidth/2), z: 0, w: sidewalkWidth, d: innerSize }
    ];
    swPositions.forEach(pos => {
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(pos.w, 0.3, pos.d), sidewalkMaterial);
      sidewalk.position.set(pos.x, 0.15, pos.z);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);
    });

    // Tiles
    TROLLOPOLY_PROPERTIES.forEach((property, index) => {
      const pos = calculateTilePosition(index);
      createTile(scene, property, index, pos);
    });

    // Background buildings
    const buildingColors = [0x444444, 0x555555, 0x666666];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 70 + Math.random() * 30;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const height = 10 + Math.random() * 25;
      const width = 5 + Math.random() * 8;
      const depth = 5 + Math.random() * 8;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(Math.random() * buildingColors.length)] }));
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      scene.add(building);
    }

    // Street lights
    const offset = size / 2 - streetWidth - sidewalkWidth / 2;
    const lightPositions = [
      { x: -25, z: -offset }, { x: 0, z: -offset }, { x: 25, z: -offset },
      { x: -25, z: offset }, { x: 0, z: offset }, { x: 25, z: offset },
      { x: -offset, z: -25 }, { x: -offset, z: 0 }, { x: -offset, z: 25 },
      { x: offset, z: -25 }, { x: offset, z: 0 }, { x: offset, z: 25 }
    ];
    lightPositions.forEach((pos) => {
      const poleGroup = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      pole.position.y = 3;
      poleGroup.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffffaa }));
      lamp.position.y = 6;
      poleGroup.add(lamp);
      if (!isDayTime) {
        const light = new THREE.PointLight(0xffaa44, 1, 20);
        light.position.set(0, 5.5, 0);
        poleGroup.add(light);
      }
      poleGroup.position.set(pos.x, 0, pos.z);
      scene.add(poleGroup);
    });

  };

  const createTile = (scene: THREE.Scene, property: typeof TROLLOPOLY_PROPERTIES[0], index: number, pos: { x: number; z: number; rotation: number }) => {
    const group = new THREE.Group();
    const tileSize = BOARD_CONFIG.tileSize - 0.3;
    
    const tileGeometry = new THREE.BoxGeometry(tileSize, 0.2, tileSize);
    const tileMaterial = new THREE.MeshStandardMaterial({ color: property.type === 'special' ? 0xffffff : 0xf5f5f5, roughness: 0.6 });
    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
    tile.position.y = 0.35;
    tile.receiveShadow = true;
    tile.castShadow = true;
    group.add(tile);

    // Add property name label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = property.type === 'special' ? '#ffffff' : '#f5f5f5';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Truncate long names
    let displayName = property.name;
    if (displayName.length > 12) {
      displayName = displayName.substring(0, 12) + '...';
    }
    ctx.fillText(displayName, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(4, 1);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.46;
    group.add(label);

    if (property.type !== 'special') {
      const barGeometry = new THREE.BoxGeometry(BOARD_CONFIG.tileSize - 0.5, 0.15, 1);
      const barMaterial = new THREE.MeshStandardMaterial({ color: property.color, emissive: property.color, emissiveIntensity: 0.2 });
      const bar = new THREE.Mesh(barGeometry, barMaterial);
      bar.position.set(0, 0.45, -BOARD_CONFIG.tileSize/2 + 0.6);
      bar.castShadow = true;
      group.add(bar);

      const priceGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16);
      const priceMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6 });
      const priceTag = new THREE.Mesh(priceGeometry, priceMaterial);
      priceTag.position.set(0, 0.42, BOARD_CONFIG.tileSize/2 - 0.6);
      group.add(priceTag);

      const buildingGroup = new THREE.Group();
      let tier: 'low' | 'mid' | 'high';
      if (property.price < 150) tier = 'low';
      else if (property.price < 300) tier = 'mid';
      else tier = 'high';

      if (tier === 'low') {
        const house = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), new THREE.MeshStandardMaterial({ color: 0xccaa88 }));
        house.position.y = 0.6;
        house.castShadow = true;
        buildingGroup.add(house);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
        roof.position.y = 1.6;
        roof.rotation.y = Math.PI / 4;
        buildingGroup.add(roof);
      } else if (tier === 'mid') {
        for (let i = 0; i < 3; i++) {
          const floor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 2), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x888888 : 0x777777 }));
          floor.position.y = 0.5 + i * 1;
          floor.castShadow = true;
          buildingGroup.add(floor);
        }
      } else {
        const glassMaterial = new THREE.MeshStandardMaterial({ color: property.color, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.9 });
        const building = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5, 2.2), glassMaterial);
        building.position.y = 2.5;
        building.castShadow = true;
        buildingGroup.add(building);
      }
      buildingGroup.position.z = 0.8;
      group.add(buildingGroup);
    } else {
      let color = 0xffffff;
      let height = 0.6;
      let geometry: THREE.BufferGeometry = new THREE.CylinderGeometry(1.2, 1.2, height, 32);
      switch(property.name) {
        case 'GO': color = 0xffd700; height = 1; geometry = new THREE.CylinderGeometry(1.5, 1.5, height, 6); break;
        case 'Troll Jail': color = 0x444444; height = 1.5; geometry = new THREE.BoxGeometry(2.5, height, 2.5); break;
        case 'Chance': color = 0xff6b6b; height = 0.5; geometry = new THREE.ConeGeometry(1.2, height * 2, 4); break;
        case 'Community Chest': color = 0x4169e1; height = 0.5; geometry = new THREE.BoxGeometry(2, height, 1.6); break;
        case 'Go To Jail': color = 0xdc143c; height = 1; geometry = new THREE.ConeGeometry(1.2, height * 2, 8); break;
        case 'Free Parking': color = 0x228b22; height = 0.8; geometry = new THREE.CylinderGeometry(1.5, 1.5, height, 32); break;
        default: color = property.color;
      }
      const marker = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
      marker.position.y = height / 2 + 0.4;
      marker.castShadow = true;
      group.add(marker);
    }

    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = pos.rotation;
    scene.add(group);
    tilesRef.current.set(index, group);
  };

  const createVehicle = (scene: THREE.Scene, user: typeof TEST_USERS[0], index: number) => {
    const group = new THREE.Group();
    const color = user.color;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 1.6), new THREE.MeshStandardMaterial({ color, metalness: 0.4 }));
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.9), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    roof.position.y = 0.725;
    group.add(roof);

    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    [[-0.4, 0.55], [0.4, 0.55], [-0.4, -0.55], [0.4, -0.55]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.15, z);
      group.add(wheel);
    });

    const roadPos = getRoadPosition(0, index);
    group.position.set(roadPos.x, 0, roadPos.z);
    group.rotation.y = roadPos.rotation;

    scene.add(group);
    vehiclesRef.current.set(user.id, group);
  };

  const createCenterDecks = (scene: THREE.Scene) => {
    // Chance deck
    const chanceGroup = new THREE.Group();
    const chanceBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xff6600 }));
    chanceBase.position.y = 0.15;
    chanceBase.castShadow = true;
    chanceGroup.add(chanceBase);
    for (let i = 0; i < 12; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: 0xfff8dc }));
      card.position.y = 0.35 + i * 0.07;
      card.rotation.y = Math.random() * 0.3 - 0.15;
      chanceGroup.add(card);
    }
    chanceGroup.position.set(-10, 0, 0);
    scene.add(chanceGroup);

    // Community deck
    const commGroup = new THREE.Group();
    const commBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0x0066ff }));
    commBase.position.y = 0.15;
    commBase.castShadow = true;
    commGroup.add(commBase);
    for (let i = 0; i < 12; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: 0xf0f8ff }));
      card.position.y = 0.35 + i * 0.07;
      card.rotation.y = Math.random() * 0.3 - 0.15;
      commGroup.add(card);
    }
    commGroup.position.set(10, 0, 0);
    scene.add(commGroup);

    // Center park
    const park = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0x3a9c3a }));
    park.position.y = 0.075;
    park.receiveShadow = true;
    scene.add(park);

    // Path
    const path = new THREE.Mesh(new THREE.RingGeometry(0, 12, 32), new THREE.MeshStandardMaterial({ color: 0xd4b896 }));
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.08;
    scene.add(path);

    // Fountain
    const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    fountainBase.position.y = 0.2;
    fountainBase.castShadow = true;
    scene.add(fountainBase);

    const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x00aaff, transparent: true, opacity: 0.7 }));
    fountainWater.position.y = 0.4;
    scene.add(fountainWater);

    const fountainCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    fountainCenter.position.y = 0.9;
    scene.add(fountainCenter);

    // Statue
    const statueBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), new THREE.MeshStandardMaterial({ color: 0x666666 }));
    statueBase.position.set(0, 0.5, -8);
    statueBase.castShadow = true;
    scene.add(statueBase);
    const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5), new THREE.MeshStandardMaterial({ color: 0xffd700 }));
    statue.position.set(0, 2, -8);
    statue.castShadow = true;
    scene.add(statue);

    // Benches
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * 10;
      const z = Math.sin(angle) * 10;
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
      seat.position.y = 0.5;
      bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
      back.position.set(0, 0.9, -0.25);
      bench.add(back);
      bench.position.set(x, 0, z);
      bench.lookAt(0, 0, 0);
      scene.add(bench);
    }

    // Park trees
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(angle) * 14;
      const z = Math.sin(angle) * 14;
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.5), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
      trunk.position.y = 0.75;
      treeGroup.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
      leaves.position.y = 2.5;
      treeGroup.add(leaves);
      treeGroup.position.set(x, 0, z);
      scene.add(treeGroup);
    }
  };

  const createDice = (scene: THREE.Scene) => {
    // Remove existing dice
    diceRef.current.forEach(die => {
      if (die.parent) die.parent.remove(die);
    });
    diceRef.current = [];
    diceVelocityRef.current = [];

    const dieSize = 2.0;
    const dieGeometry = new THREE.BoxGeometry(dieSize, dieSize, dieSize);
    const dieColors = [0xff3333, 0x3366ff];
    
    for (let i = 0; i < 2; i++) {
      const dieGroup = new THREE.Group();
      
      // Main die body
      const dieMaterial = new THREE.MeshStandardMaterial({
        color: dieColors[i],
        roughness: 0.3,
        metalness: 0.2
      });
      const die = new THREE.Mesh(dieGeometry, dieMaterial);
      die.castShadow = true;
      dieGroup.add(die);
      
      // Add pips
      const pipMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pipSize = 0.25;
      const offset = dieSize / 2 + 0.01;
      
      // Face configurations: [value, normalX, normalY, normalZ]
      const faceConfigs = [
        { value: 1, nx: 0, ny: 0, nz: 1, positions: [[0, 0]] },
        { value: 6, nx: 0, ny: 0, nz: -1, positions: [[-0.4, 0.4], [0.4, 0.4], [-0.4, 0], [0.4, 0], [-0.4, -0.4], [0.4, -0.4]] },
        { value: 3, nx: 1, ny: 0, nz: 0, positions: [[-0.4, 0.4], [0, 0], [0.4, -0.4]] },
        { value: 4, nx: -1, ny: 0, nz: 0, positions: [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4]] },
        { value: 2, nx: 0, ny: 1, nz: 0, positions: [[-0.4, 0.4], [0.4, -0.4]] },
        { value: 5, nx: 0, ny: -1, nz: 0, positions: [[-0.4, 0.4], [0.4, 0.4], [0, 0], [-0.4, -0.4], [0.4, -0.4]] }
      ];
      
      faceConfigs.forEach(face => {
        face.positions.forEach(([px, py]) => {
          const pip = new THREE.Mesh(new THREE.SphereGeometry(pipSize, 8, 8), pipMaterial);
          if (face.nx !== 0) {
            pip.position.set(face.nx * offset, py, px);
          } else if (face.ny !== 0) {
            pip.position.set(px, face.ny * offset, py);
          } else {
            pip.position.set(px, py, face.nz * offset);
          }
          dieGroup.add(pip);
        });
      });
      
      // Position in center park
      dieGroup.position.set(i === 0 ? -3 : 3, dieSize / 2 + 0.2, 0);
      dieGroup.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      scene.add(dieGroup);
      diceRef.current.push(dieGroup as any);
      
      // Physics
      diceVelocityRef.current.push({
        x: (Math.random() - 0.5) * 0.8,
        y: 0.5,
        z: (Math.random() - 0.5) * 0.8,
        rotX: (Math.random() - 0.5) * 0.6,
        rotY: (Math.random() - 0.5) * 0.6,
        rotZ: (Math.random() - 0.5) * 0.6
      });
    }
  };

  const animateDicePhysics = () => {
    if (!sceneRef.current) return;
    diceRef.current.forEach((die, i) => {
      const vel = diceVelocityRef.current[i];
      die.position.x += vel.x;
      die.position.y += vel.y;
      die.position.z += vel.z;
      die.rotation.x += vel.rotX;
      die.rotation.y += vel.rotY;
      die.rotation.z += vel.rotZ;
      vel.y -= 0.012;
      if (die.position.y <= 0.6) {
        die.position.y = 0.6;
        vel.y *= -0.5;
        vel.x *= 0.85;
        vel.z *= 0.85;
        vel.rotX *= 0.85;
        vel.rotY *= 0.85;
        vel.rotZ *= 0.85;
      }
      const boardLimit = 30;
      if (Math.abs(die.position.x) > boardLimit) vel.x *= -0.8;
      if (Math.abs(die.position.z) > boardLimit) vel.z *= -0.8;
    });
  };

  const zoomCameraToTile = (tileIndex: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const pos = calculateTilePosition(tileIndex);
    const targetPos = new THREE.Vector3(pos.x, 0, pos.z);
    const startPos = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const endPos = new THREE.Vector3(pos.x * 0.6, 35, pos.z * 0.6);
    let progress = 0;
    const animate = () => {
      progress += 0.03;
      if (progress >= 1) progress = 1;
      const ease = 1 - Math.pow(1 - progress, 3);
      cameraRef.current!.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current!.target.lerpVectors(startTarget, targetPos, ease);
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  };

  const updateVehiclePosition = (playerIndex: number, targetTile: number) => {
    const user = TEST_USERS[playerIndex];
    const vehicle = vehiclesRef.current.get(user.id);
    if (!vehicle) return;

    const currentTile = playerPositions[playerIndex];
    setMovingVehicle(user.id);
    let stepsMoved = 0;
    const totalSteps = (targetTile - currentTile + 40) % 40;
    
    const moveStep = () => {
      const tileIndex = (currentTile + stepsMoved + 1) % 40;
      const roadPos = getRoadPosition(tileIndex, playerIndex);
      const startX = vehicle.position.x;
      const startZ = vehicle.position.z;
      const startRot = vehicle.rotation.y;
      let stepProgress = 0;
      const stepDuration = 350;
      const stepStart = Date.now();
      
      const animateStep = () => {
        const elapsed = Date.now() - stepStart;
        stepProgress = Math.min(elapsed / stepDuration, 1);
        const ease = 1 - Math.pow(1 - stepProgress, 3);
        vehicle.position.x = startX + (roadPos.x - startX) * ease;
        vehicle.position.z = startZ + (roadPos.z - startZ) * ease;
        let rotDiff = roadPos.rotation - startRot;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        vehicle.rotation.y = startRot + rotDiff * ease;
        if (stepProgress < 1) {
          requestAnimationFrame(animateStep);
        } else {
          stepsMoved++;
          if (stepsMoved <= totalSteps) {
            setTimeout(moveStep, 60);
          } else {
            setMovingVehicle(null);
            const property = TROLLOPOLY_PROPERTIES[targetTile];
            setSelectedProperty(property);
            setShowPropertyPopup(true);
            zoomCameraToTile(targetTile);
          }
        }
      };
      animateStep();
    };
    moveStep();
  };

  const rollDice = () => {
    if (isRolling || movingVehicle) return;
    
    const playerIndex = currentPlayerIndex;
    
    // Check if player is in jail
    if (jailedPlayers[playerIndex]) {
      // Deduct 100 coins to release from jail
      setPlayerCoins(prev => {
        const newCoins = [...prev];
        newCoins[playerIndex] = Math.max(0, newCoins[playerIndex] - 100);
        return newCoins;
      });
      
      // Release from jail
      setJailedPlayers(prev => {
        const newJailed = [...prev];
        newJailed[playerIndex] = false;
        return newJailed;
      });
      
      setJailMessage(`${TEST_USERS[playerIndex].username} paid 100 TC to escape jail!`);
      setShowJailAnimation(true);
      setTimeout(() => setShowJailAnimation(false), 2000);
      
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(msgs => [...msgs, { user: 'System', msg: `${TEST_USERS[playerIndex].username} paid 100 TC and was released from jail!`, time }]);
    }
    
    setIsRolling(true);
    setShowPropertyPopup(false);
    
    // Roll the dice
    const finalDie1 = Math.floor(Math.random() * 6) + 1;
    const finalDie2 = Math.floor(Math.random() * 6) + 1;
    
    setDiceValues({ die1: finalDie1, die2: finalDie2 });
    
    if (sceneRef.current) createDice(sceneRef.current);
    setDiceAnimating(true);
    
    setTimeout(() => {
      setDiceAnimating(false);
      
      const faceRotations: Record<number, { x: number; y: number; z: number }> = {
        1: { x: Math.PI / 2, y: 0, z: 0 },
        2: { x: 0, y: 0, z: 0 },
        3: { x: 0, y: 0, z: -Math.PI / 2 },
        4: { x: 0, y: 0, z: Math.PI / 2 },
        5: { x: Math.PI, y: 0, z: 0 },
        6: { x: -Math.PI / 2, y: 0, z: 0 }
      };
      
      diceRef.current.forEach((die, i) => {
        const value = i === 0 ? finalDie1 : finalDie2;
        const targetRot = faceRotations[value];
        const startRot = { x: die.rotation.x, y: die.rotation.y, z: die.rotation.z };
        const startTime = Date.now();
        const duration = 500;
        
        const animateToFinal = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          
          die.rotation.x = startRot.x + (targetRot.x - startRot.x) * ease;
          die.rotation.y = startRot.y + (targetRot.y - startRot.y) * ease;
          die.rotation.z = startRot.z + (targetRot.z - startRot.z) * ease;
          die.position.y = 1.0 + Math.sin(progress * Math.PI) * 0.3;
          
          if (progress < 1) {
            requestAnimationFrame(animateToFinal);
          } else {
            die.position.y = 1.0;
          }
        };
        animateToFinal();
      });
      
      setTimeout(() => {
        const total = finalDie1 + finalDie2;
        const currentPos = playerPositions[playerIndex];
        const newPos = (currentPos + total) % 40;
        
        setPlayerPositions(prev => {
          const newPositions = [...prev];
          newPositions[playerIndex] = newPos;
          return newPositions;
        });
        
        updateVehiclePosition(playerIndex, newPos);
        
        const player = TEST_USERS[playerIndex];
        const property = TROLLOPOLY_PROPERTIES[newPos];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Check if landed on "Go To Jail"
        if (property.name === 'Go To Jail') {
          setJailedPlayers(prev => {
            const newJailed = [...prev];
            newJailed[playerIndex] = true;
            return newJailed;
          });
          setJailMessage(`${player.username} was sent to JAIL!`);
          setShowJailAnimation(true);
          setTimeout(() => setShowJailAnimation(false), 3000);
          setChatMessages(msgs => [...msgs, { user: 'System', msg: `${player.username} landed on Go To Jail and was sent to Troll Jail!`, time }]);
        } else {
          setChatMessages(msgs => [...msgs, { user: 'System', msg: `${player.username} rolled ${total} and landed on ${property.name}`, time }]);
        }
        
        setTimeout(() => {
          setIsRolling(false);
          setCurrentPlayerIndex(prev => (prev + 1) % TEST_USERS.length);
        }, 5000);
      }, 600);
    }, 2500);
  };

  const buyProperty = () => {
    if (!selectedProperty) return;
    const playerIndex = currentPlayerIndex;
    const currentCoins = playerCoins[playerIndex];
    if (currentCoins >= selectedProperty.price) {
      setPlayerCoins(prev => {
        const newCoins = [...prev];
        newCoins[playerIndex] = prev[playerIndex] - selectedProperty.price;
        return newCoins;
      });
      const player = TEST_USERS[playerIndex];
      setChatMessages(msgs => [...msgs, { user: 'System', msg: `${player.username} bought ${selectedProperty.name} for ${selectedProperty.price} TC!`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setShowPropertyPopup(false);
    }
  };

  const resetGame = () => {
    setCurrentPlayerIndex(0);
    setPlayerPositions([0, 0, 0, 0]);
    setPlayerCoins([1500, 1500, 1500, 1500]);
    setDiceValues({ die1: 1, die2: 1 });
    setShowPropertyPopup(false);
    setChatMessages([{ user: 'System', msg: 'Game reset!', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    TEST_USERS.forEach((user, index) => {
      const vehicle = vehiclesRef.current.get(user.id);
      if (vehicle) {
        const roadPos = getRoadPosition(0, index);
        vehicle.position.set(roadPos.x, 0, roadPos.z);
        vehicle.rotation.y = roadPos.rotation;
      }
    });
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(60, 70, 60);
      controlsRef.current.target.set(0, 0, 0);
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(msgs => [...msgs, { user: 'You', msg: chatInput, time }]);
    setChatInput('');
  };

  const getCornerStyles = (index: number) => {
    if (index === 0) return 'top-4 left-4';
    if (index === 1) return 'top-4 right-4';
    if (index === 2) return 'bottom-4 left-4';
    return 'bottom-4 right-4';
  };

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      {isLoading && !webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Loading Trollopoly City...</p>
          </div>
        </div>
      )}

      {webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900 p-8">
          <div className="max-w-md text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">3D Graphics Error</h2>
            <p className="text-slate-300 mb-6">{webglError}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-lg">Retry</button>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="px-6 py-3 bg-slate-800/90 rounded-full border border-slate-600">
          <h1 className="text-xl font-bold text-white">🏙️ Trollopoly City</h1>
          <p className="text-slate-400 text-sm text-center">Enhanced 3D Board Game</p>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-30">
        <button onClick={() => setIsDayTime(!isDayTime)} className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-full border border-slate-600 hover:bg-slate-700">
          {isDayTime ? (<><Moon size={18} className="text-blue-400" /><span className="text-white text-sm">Night</span></>) : (<><Sun size={18} className="text-yellow-400" /><span className="text-white text-sm">Day</span></>)}
        </button>
      </div>

      {TEST_USERS.map((user, index) => (
        <div key={user.id} className={`absolute ${getCornerStyles(index)} z-20`}>
          <div className={`bg-slate-800 rounded-xl overflow-hidden border-2 ${currentPlayerIndex === index ? 'border-yellow-400' : 'border-slate-600'}`} style={{ width: '180px' }}>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#' + user.color.toString(16).padStart(6, '0') }}>
                  {user.username.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{user.username}</p>
                  <p className="text-yellow-400 text-xs">{playerCoins[index].toLocaleString()} TC</p>
                  {jailedPlayers[index] && (
                    <p className="text-red-500 text-xs font-bold">🔒 IN JAIL</p>
                  )}
                </div>
              </div>
              {currentPlayerIndex === index && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-green-500 rounded-full text-xs text-white">YOUR TURN</span>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-4 bg-slate-800/90 px-6 py-3 rounded-xl border border-slate-600">
          <div className={`w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 ${diceAnimating ? 'animate-pulse' : ''}`}>{diceValues.die1}</div>
          <span className="text-xl text-white font-bold">+</span>
          <div className={`w-16 h-16 rounded-xl bg-white flex items-center justify-center text-3xl font-bold text-slate-900 ${diceAnimating ? 'animate-pulse' : ''}`}>{diceValues.die2}</div>
          <span className="text-xl text-white font-bold">=</span>
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl font-bold text-white">{diceValues.die1 + diceValues.die2}</div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        <button onClick={rollDice} disabled={isRolling || movingVehicle !== null} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl">
          <Dice5 size={20} />
          {isRolling ? 'Rolling...' : movingVehicle ? 'Moving...' : 'Roll Dice'}
        </button>
        <button onClick={resetGame} className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">
          <RotateCcw size={20} /> Reset
        </button>
      </div>
      
      {/* Jail Animation Overlay */}
      {showJailAnimation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="relative w-full h-full overflow-hidden">
            {/* Jail Bars Animation */}
            <div className="absolute inset-0 flex">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-700 border-x-2 border-slate-600"
                  style={{
                    animation: `jailSlide 0.5s ease-out ${i * 0.05}s both`,
                    transform: 'translateY(-100%)'
                  }}
                />
              ))}
            </div>
            {/* Jail Message */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ animation: 'fadeIn 0.3s ease-out 0.5s both' }}>
              <div className="bg-red-900/90 px-8 py-6 rounded-2xl border-4 border-red-600 shadow-2xl text-center">
                <div className="text-6xl mb-3">🔒</div>
                <h2 className="text-3xl font-bold text-white mb-2">JAIL!</h2>
                <p className="text-red-200 text-lg">{jailMessage}</p>
                <p className="text-red-300 text-sm mt-2">Pay 100 TC on your next turn to escape</p>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes jailSlide {
              to { transform: translateY(0); }
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.8); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
      
      {showPropertyPopup && selectedProperty && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-slate-900">{selectedProperty.name}</h2>
              <button onClick={() => setShowPropertyPopup(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <div className="h-6 rounded-full mb-4" style={{ backgroundColor: '#' + selectedProperty.color.toString(16).padStart(6, '0') }} />
            <div className="space-y-2 mb-6">
              <div className="flex justify-between"><span className="text-slate-600">Price:</span><span className="font-bold text-slate-900">{selectedProperty.price} TC</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Base Rent:</span><span className="font-bold text-slate-900">{Math.floor(selectedProperty.price * 0.1)} TC</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Type:</span><span className="capitalize text-slate-900">{selectedProperty.type}</span></div>
            </div>
            <div className="flex gap-3">
              {selectedProperty.type !== 'special' && selectedProperty.price > 0 && (
                <button onClick={buyProperty} disabled={playerCoins[currentPlayerIndex] < selectedProperty.price} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-lg">
                  <ShoppingCart size={18} /> Buy
                </button>
              )}
              <button onClick={() => setShowPropertyPopup(false)} className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {showChat && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
          <div className="w-72 bg-slate-800/95 rounded-xl border border-slate-600 overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-slate-700/50 border-b border-slate-600">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-slate-400" />
                <span className="text-white text-sm font-medium">Chat</span>
              </div>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            <div className="h-48 overflow-y-auto p-3 space-y-2">
              {chatMessages.map((msg, i) => (
                <div key={i} className="text-sm">
                  <span className="text-slate-500 text-xs">{msg.time} </span>
                  <span className={msg.user === 'System' ? 'text-yellow-400' : 'text-blue-400'}>{msg.user}:</span>
                  <span className="text-slate-200"> {msg.msg}</span>
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} className="p-3 border-t border-slate-600">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type message..." className="flex-1 px-3 py-2 bg-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white"><Send size={14} /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!showChat && (
        <button onClick={() => setShowChat(true)} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-600 text-white">
          <MessageSquare size={18} />
        </button>
      )}
    </div>
  );
}
