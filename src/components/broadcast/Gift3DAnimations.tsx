/**
 * 3D Gift Animation System
 * Uses React Three Fiber / Three.js for realistic 3D gift animations
 * Each gift gets a unique 3D scene with proper materials, lighting, and physics
 */

import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, ContactShadows, Float, Text3D, Center, MeshDistortMaterial, MeshTransmissionMaterial, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { createPortal } from 'react-dom';
import { playGiftSound } from '../../lib/giftSoundMap';
import '../../pages/dev/gift-3d.css';

// Detect scene type from gift name
function detectScene(name: string, icon: string): string {
  const s = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  if (s.includes('rose') || s.includes('flower') || s.includes('bouquet') || s.includes('🌹')) return 'rose';
  if (s.includes('heart') || s.includes('love') || s.includes('pulse') || s.includes('❤') || s.includes('💖')) return 'heart';
  if (s.includes('crown') || s.includes('king') || s.includes('queen') || s.includes('👑')) return 'crown';
  if (s.includes('diamond') || s.includes('gem') || s.includes('💎') || s.includes('bling')) return 'diamond';
  if (s.includes('fire') || s.includes('flame') || s.includes('blaze') || s.includes('🔥')) return 'fire';
  if (s.includes('car') || s.includes('auto') || s.includes('drift') || s.includes('🏎')) return 'car';
  if (s.includes('rocket') || s.includes('launch') || s.includes('🚀')) return 'rocket';
  if (s.includes('money') || s.includes('cash') || s.includes('dollar') || s.includes('💵') || s.includes('💸')) return 'money';
  if (s.includes('coin') || s.includes('flip') || s.includes('🪙')) return 'coin';
  if (s.includes('champagne') || s.includes('bubbly') || s.includes('🍾')) return 'champagne';
  if (s.includes('ice cream') || s.includes('icecream') || s.includes('🍦')) return 'ice-cream';
  if (s.includes('bomb') || s.includes('explode') || s.includes('💣') || s.includes('tnt')) return 'bomb';
  if (s.includes('trophy') || s.includes('award') || s.includes('🏆')) return 'trophy';
  if (s.includes('star') || s.includes('⭐') || s.includes('shooting')) return 'star';
  if (s.includes('skull') || s.includes('💀') || s.includes('death')) return 'skull';
  if (s.includes('dragon') || s.includes('🐉')) return 'dragon';
  if (s.includes('police') || s.includes('siren') || s.includes('🚨')) return 'police';
  if (s.includes('pizza') || s.includes('🍕')) return 'pizza';
  if (s.includes('coffee') || s.includes('☕')) return 'coffee';
  if (s.includes('beer') || s.includes('🍺')) return 'beer';
  if (s.includes('wine') || s.includes('🍷')) return 'wine';
  if (s.includes('music') || s.includes('🎵') || s.includes('mic') || s.includes('🎤')) return 'music';
  if (s.includes('rainbow') || s.includes('🌈')) return 'rainbow';
  if (s.includes('snow') || s.includes('❄') || s.includes('ice')) return 'snow';
  if (s.includes('tornado') || s.includes('🌪')) return 'tornado';
  if (s.includes('ghost') || s.includes('👻')) return 'ghost';
  if (s.includes('balloon') || s.includes('🎈')) return 'balloon';
  if (s.includes('gift') || s.includes('present') || s.includes('🎁')) return 'gift-box';
  if (s.includes('ring') || s.includes('💍')) return 'ring';
  if (s.includes('like') || s.includes('👍') || s.includes('thumb')) return 'like';
  if (s.includes('camera') || s.includes('📸') || s.includes('flash')) return 'camera';
  if (s.includes('hammer') || s.includes('🔨') || s.includes('smash')) return 'hammer';
  if (s.includes('sword') || s.includes('🗡') || s.includes('⚔')) return 'sword';
  if (s.includes('shield') || s.includes('🛡')) return 'shield';
  if (s.includes('house') || s.includes('🏠') || s.includes('castle') || s.includes('🏰')) return 'house';
  if (s.includes('helicopter') || s.includes('🚁')) return 'helicopter';
  if (s.includes('plane') || s.includes('✈') || s.includes('airplane')) return 'plane';
  if (s.includes('boat') || s.includes('ship') || s.includes('⛵')) return 'boat';
  if (s.includes('train') || s.includes('🚂')) return 'train';
  if (s.includes('game') || s.includes('🎮')) return 'game';
  if (s.includes('hug') || s.includes('🤗')) return 'hug';
  if (s.includes('kiss') || s.includes('💋')) return 'kiss';
  if (s.includes('laugh') || s.includes('😂') || s.includes('haha')) return 'laugh';
  if (s.includes('cry') || s.includes('😢') || s.includes('tear')) return 'cry';
  if (s.includes('angry') || s.includes('😤') || s.includes('rage')) return 'angry';
  if (s.includes('cool') || s.includes('😎')) return 'cool';
  if (s.includes('candle') || s.includes('🕯')) return 'candle';
  if (s.includes('smoke') || s.includes('💨') || s.includes('blunt') || s.includes('🚬')) return 'smoke';
  if (s.includes('clap') || s.includes('applause') || s.includes('👏')) return 'clap';
  if (s.includes('sun') || s.includes('☀')) return 'sun';
  if (s.includes('moon') || s.includes('🌙')) return 'moon';
  if (s.includes('earth') || s.includes('🌍') || s.includes('globe')) return 'earth';
  if (s.includes('volcano') || s.includes('🌋')) return 'volcano';
  if (s.includes('wave') || s.includes('🌊') || s.includes('ocean')) return 'wave';
  if (s.includes('spark') || s.includes('⚡') || s.includes('electric') || s.includes('zap')) return 'spark';
  return 'default';
}

// ========== 3D SCENE COMPONENTS ==========

// Generic animated mesh with material
function AnimatedMesh({ geometry, color, position, rotation, scale, distort, speed = 1 }: {
  geometry: 'sphere' | 'box' | 'torus' | 'octahedron' | 'icosahedron' | 'dodecahedron';
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  distort?: number;
  speed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed;
    meshRef.current.rotation.x = (rotation?.[0] || 0) + Math.sin(t) * 0.3;
    meshRef.current.rotation.y = (rotation?.[1] || 0) + t * 0.5;
    meshRef.current.rotation.z = (rotation?.[2] || 0) + Math.cos(t) * 0.2;
  });

  const geo = useMemo(() => {
    switch (geometry) {
      case 'sphere': return new THREE.SphereGeometry(1, 64, 64);
      case 'box': return new THREE.BoxGeometry(1.5, 1.5, 1.5, 4, 4, 4);
      case 'torus': return new THREE.TorusGeometry(1, 0.4, 32, 64);
      case 'octahedron': return new THREE.OctahedronGeometry(1.2, 0);
      case 'icosahedron': return new THREE.IcosahedronGeometry(1.2, 0);
      case 'dodecahedron': return new THREE.DodecahedronGeometry(1.2, 0);
      default: return new THREE.SphereGeometry(1, 64, 64);
    }
  }, [geometry]);

  return (
    <mesh ref={meshRef} geometry={geo} position={position} scale={scale || 1}>
      {distort ? (
        <MeshDistortMaterial color={color} roughness={0.1} metalness={0.8} distort={distort} speed={2} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.15} metalness={0.9} envMapIntensity={2} />
      )}
    </mesh>
  );
}

// Rose scene - 3D rose with falling petals
function SceneRose() {
  const petalsRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!petalsRef.current) return;
    petalsRef.current.children.forEach((child, i) => {
      child.position.y -= 0.008 + i * 0.002;
      child.rotation.x += 0.02;
      child.rotation.z += 0.015;
      if (child.position.y < -3) child.position.y = 3;
    });
  });

  return (
    <>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <AnimatedMesh geometry="dodecahedron" color="#e91e63" scale={0.8} distort={0.3} speed={1.5} />
      </Float>
      <group ref={petalsRef}>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh key={i} position={[
            Math.sin(i * 0.8) * 2,
            3 - i * 0.3,
            Math.cos(i * 0.8) * 2
          ]} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]} scale={0.15}>
            <planeGeometry args={[0.5, 0.3]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#e91e63' : '#f48fb1'} side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <Sparkles count={50} scale={4} size={2} speed={0.5} color="#e91e63" />
      <pointLight position={[0, 2, 2]} intensity={3} color="#e91e63" distance={8} />
    </>
  );
}

// Heart scene - pulsing 3D heart with glow rings
function SceneHeart() {
  const ringsRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!ringsRef.current) return;
    ringsRef.current.children.forEach((ring, i) => {
      const t = state.clock.elapsedTime;
      const scale = 1 + Math.sin(t * 3 + i * 0.5) * 0.2;
      ring.scale.set(scale, scale, scale);
      ring.rotation.z = t * 0.3 + i * 0.5;
      const mat = (ring as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat) mat.opacity = 0.3 + Math.sin(t * 3 + i) * 0.2;
    });
  });

  return (
    <>
      <Float speed={3} rotationIntensity={0.2} floatIntensity={0.8}>
        <AnimatedMesh geometry="sphere" color="#ff1744" scale={0.7} distort={0.4} speed={3} />
      </Float>
      <group ref={ringsRef}>
        {[0, 1, 2].map(i => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.2 + i * 0.4, 0.03, 16, 64]} />
            <meshStandardMaterial color="#ff1744" transparent opacity={0.3} emissive="#ff1744" emissiveIntensity={2} />
          </mesh>
        ))}
      </group>
      <Sparkles count={80} scale={5} size={3} speed={1} color="#ff4081" />
      <pointLight position={[0, 0, 2]} intensity={5} color="#ff1744" distance={10} />
    </>
  );
}

// Crown scene - golden crown with sparkle rays
function SceneCrown() {
  const crownRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!crownRef.current) return;
    crownRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    crownRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });

  return (
    <>
      <group ref={crownRef}>
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.8, 1, 0.6, 8]} />
            <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={1} envMapIntensity={3} />
          </mesh>
          {[0, 1, 2, 3, 4].map(i => (
            <mesh key={i} position={[Math.sin(i * Math.PI * 2 / 5) * 0.7, 0.6, Math.cos(i * Math.PI * 2 / 5) * 0.7]} scale={0.15}>
              <octahedronGeometry args={[1]} />
              <meshStandardMaterial color="#ff1744" roughness={0.05} metalness={0.5} emissive="#ff1744" emissiveIntensity={1} />
            </mesh>
          ))}
        </Float>
      </group>
      <Sparkles count={100} scale={5} size={4} speed={0.8} color="#ffd700" />
      <spotLight position={[0, 4, 0]} angle={0.4} penumbra={0.5} intensity={8} color="#ffd700" castShadow />
      <pointLight position={[0, 2, 3]} intensity={3} color="#ffd700" />
    </>
  );
}

// Diamond scene - rotating diamond with refracted light
function SceneDiamond() {
  return (
    <>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh>
          <octahedronGeometry args={[1, 0]} />
          <MeshTransmissionMaterial
            backside
            backsideThickness={2}
            samples={16}
            resolution={512}
            transmission={1}
            roughness={0.0}
            thickness={0.5}
            ior={2.42}
            chromaticAberration={0.06}
            anisotropy={0.1}
            distortion={0.0}
            distortionScale={0.3}
            color="#b3e5fc"
          />
        </mesh>
      </Float>
      <Sparkles count={150} scale={6} size={5} speed={0.3} color="#80deea" />
      <pointLight position={[2, 2, 2]} intensity={5} color="#00e5ff" />
      <pointLight position={[-2, -1, 2]} intensity={3} color="#e040fb" />
      <pointLight position={[0, 3, -2]} intensity={3} color="#b388ff" />
    </>
  );
}

// Fire scene - emissive spheres with distortion
function SceneFire() {
  const fireRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!fireRef.current) return;
    fireRef.current.children.forEach((child, i) => {
      const t = state.clock.elapsedTime;
      child.position.y = Math.sin(t * 4 + i) * 0.3 + i * 0.15;
      child.scale.setScalar(0.3 + Math.sin(t * 5 + i * 0.7) * 0.1);
    });
  });

  return (
    <>
      <group ref={fireRef} position={[0, -0.5, 0]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[Math.sin(i * 0.8) * 0.3, i * 0.15, Math.cos(i * 0.8) * 0.3]}>
            <sphereGeometry args={[0.25 - i * 0.02, 16, 16]} />
            <MeshDistortMaterial
              color={i < 3 ? '#ff4500' : i < 5 ? '#ff6d00' : '#ffab00'}
              emissive={i < 3 ? '#ff1744' : '#ff6d00'}
              emissiveIntensity={3}
              roughness={0.5}
              distort={0.5}
              speed={5}
              transparent
              opacity={0.9 - i * 0.05}
            />
          </mesh>
        ))}
      </group>
      <Sparkles count={60} scale={4} size={2} speed={2} color="#ff6d00" />
      <pointLight position={[0, 0, 2]} intensity={8} color="#ff4500" distance={8} />
      <pointLight position={[0, -1, 1]} intensity={4} color="#ffab00" distance={5} />
    </>
  );
}

// Car scene - metallic car shape on a road
function SceneCar() {
  const carRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!carRef.current) return;
    carRef.current.position.x = Math.sin(state.clock.elapsedTime * 1.5) * 2;
    carRef.current.rotation.y = Math.cos(state.clock.elapsedTime * 1.5) * 0.3;
    carRef.current.position.z = Math.cos(state.clock.elapsedTime * 0.5) * 0.5;
  });

  return (
    <>
      <group ref={carRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 0.5, 1]} />
          <meshStandardMaterial color="#f44336" roughness={0.1} metalness={0.95} envMapIntensity={3} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.9]} />
          <meshStandardMaterial color="#e53935" roughness={0.15} metalness={0.9} envMapIntensity={2} />
        </mesh>
        {[[-0.6, -0.3, 0.5], [-0.6, -0.3, -0.5], [0.6, -0.3, 0.5], [0.6, -0.3, -0.5]].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
            <meshStandardMaterial color="#212121" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <Sparkles count={30} scale={5} size={1} speed={3} color="#ffab00" />
      <spotLight position={[3, 3, 0]} angle={0.3} penumbra={0.5} intensity={6} color="#ffffff" castShadow />
    </>
  );
}

// Money scene - gold bars and floating bills
function SceneMoney() {
  const billsRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!billsRef.current) return;
    billsRef.current.children.forEach((child, i) => {
      const t = state.clock.elapsedTime;
      child.position.y = Math.sin(t * 2 + i * 0.7) * 0.5 + 1;
      child.rotation.y = t * 0.5 + i;
      child.rotation.x = Math.sin(t + i) * 0.3;
    });
  });

  return (
    <>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.5, 0.6, 0.8]} />
        <meshStandardMaterial color="#ffd700" roughness={0.05} metalness={1} envMapIntensity={3} />
      </mesh>
      <group ref={billsRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[Math.sin(i) * 1.5, 1, Math.cos(i) * 1.5]} scale={0.3}>
            <boxGeometry args={[2, 0.02, 1]} />
            <meshStandardMaterial color="#4caf50" roughness={0.3} metalness={0.2} />
          </mesh>
        ))}
      </group>
      <Sparkles count={80} scale={5} size={3} speed={0.5} color="#ffd700" />
      <pointLight position={[0, 2, 2]} intensity={5} color="#ffd700" distance={8} />
    </>
  );
}

// Coin scene - spinning gold coin
function SceneCoin() {
  const coinRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!coinRef.current) return;
    coinRef.current.rotation.y = state.clock.elapsedTime * 3;
    coinRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.3;
  });

  return (
    <>
      <mesh ref={coinRef}>
        <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
        <meshStandardMaterial color="#ffd700" roughness={0.05} metalness={1} envMapIntensity={4} />
      </mesh>
      <Sparkles count={40} scale={3} size={2} speed={1} color="#ffd700" />
      <pointLight position={[0, 2, 2]} intensity={5} color="#ffd700" distance={6} />
    </>
  );
}

// Rocket scene - rocket launching upward
function SceneRocket() {
  const rocketRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!rocketRef.current) return;
    rocketRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.5;
    rocketRef.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.1;
  });

  return (
    <>
      <group ref={rocketRef} rotation={[0, 0, 0.2]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 2, 16]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.2} metalness={0.8} />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <coneGeometry args={[0.3, 0.6, 16]} />
          <meshStandardMaterial color="#f44336" roughness={0.3} metalness={0.5} />
        </mesh>
        <mesh position={[0, -1.2, 0]}>
          <coneGeometry args={[0.5, 0.4, 16]} />
          <MeshDistortMaterial color="#ff6d00" emissive="#ff4500" emissiveIntensity={5} distort={0.5} speed={8} transparent opacity={0.8} />
        </mesh>
      </group>
      <Sparkles count={100} scale={5} size={2} speed={3} color="#ff6d00" position={[0, -2, 0]} />
      <Stars radius={10} depth={20} count={500} factor={2} saturation={0} />
      <pointLight position={[0, -2, 1]} intensity={8} color="#ff4500" distance={6} />
    </>
  );
}

// Bomb scene - pulsing bomb with fuse
function SceneBomb() {
  const bombRef = useRef<THREE.Group>(null);
  const [exploded, setExploded] = useState(false);
  
  useFrame((state) => {
    if (!bombRef.current) return;
    const t = state.clock.elapsedTime;
    bombRef.current.scale.setScalar(1 + Math.sin(t * 8) * 0.05);
    if (t > 2 && !exploded) setExploded(true);
  });

  return (
    <>
      <group ref={bombRef} scale={exploded ? 3 : 1}>
        <mesh>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color="#212121" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#795548" roughness={0.6} />
        </mesh>
        <pointLight position={[0, 1, 0]} intensity={exploded ? 20 : 3} color="#ff6d00" distance={exploded ? 15 : 4} />
      </group>
      {exploded && <Sparkles count={200} scale={8} size={5} speed={5} color="#ff4500" />}
      {exploded && <Sparkles count={100} scale={6} size={3} speed={4} color="#ffab00" />}
    </>
  );
}

// Trophy scene - golden trophy with confetti
function SceneTrophy() {
  const trophyRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!trophyRef.current) return;
    trophyRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    trophyRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
  });

  return (
    <>
      <group ref={trophyRef}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#ffd700" roughness={0.05} metalness={1} envMapIntensity={3} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.5, 0.3, 0.8, 16]} />
          <meshStandardMaterial color="#ffd700" roughness={0.05} metalness={1} envMapIntensity={3} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <torusGeometry args={[0.35, 0.08, 16, 32]} />
          <meshStandardMaterial color="#ffd700" roughness={0.05} metalness={1} />
        </mesh>
      </group>
      <Sparkles count={100} scale={5} size={4} speed={0.5} color="#ffd700" />
      <Sparkles count={50} scale={4} size={2} speed={1} color="#ff4081" />
      <spotLight position={[0, 4, 2]} angle={0.4} penumbra={0.5} intensity={10} color="#ffd700" />
    </>
  );
}

// Police scene - red/blue alternating lights
function ScenePolice() {
  const lightRef = useRef<THREE.PointLight>(null);
  const lightRef2 = useRef<THREE.PointLight>(null);
  
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (lightRef.current) {
      lightRef.current.intensity = Math.abs(Math.sin(t * 6)) * 10;
      lightRef.current.color.setHex(Math.sin(t * 6) > 0 ? 0xff0000 : 0x0000ff);
    }
    if (lightRef2.current) {
      lightRef2.current.intensity = Math.abs(Math.cos(t * 6)) * 10;
      lightRef2.current.color.setHex(Math.cos(t * 6) > 0 ? 0x0000ff : 0xff0000);
    }
  });

  return (
    <>
      <mesh>
        <boxGeometry args={[3, 0.3, 0.3]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.8} />
      </mesh>
      <pointLight ref={lightRef} position={[-1, 0.5, 1]} intensity={10} color="#ff0000" distance={8} />
      <pointLight ref={lightRef2} position={[1, 0.5, 1]} intensity={10} color="#0000ff" distance={8} />
      <Sparkles count={30} scale={4} size={2} speed={3} color="#ff0000" />
    </>
  );
}

// Snow scene
function SceneSnow() {
  return (
    <>
      <Float speed={1} rotationIntensity={0.1}>
        <AnimatedMesh geometry="icosahedron" color="#e3f2fd" scale={0.6} distort={0.2} speed={0.5} />
      </Float>
      <Sparkles count={200} scale={8} size={3} speed={0.3} color="#ffffff" position={[0, 2, 0]} />
      <pointLight position={[0, 3, 2]} intensity={3} color="#e3f2fd" />
    </>
  );
}

// Star scene
function SceneStar() {
  return (
    <>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <AnimatedMesh geometry="octahedron" color="#ffc107" scale={0.8} distort={0.15} speed={2} />
      </Float>
      <Stars radius={8} depth={15} count={300} factor={2} saturation={0} />
      <Sparkles count={80} scale={5} size={4} speed={0.5} color="#ffd700" />
      <pointLight position={[0, 0, 3]} intensity={8} color="#ffc107" distance={10} />
    </>
  );
}

// Default scene for unmapped gifts
function SceneDefault({ color }: { color: string }) {
  return (
    <>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
        <AnimatedMesh geometry="dodecahedron" color={color} scale={0.8} distort={0.2} speed={1.5} />
      </Float>
      <Sparkles count={60} scale={5} size={3} speed={0.5} color={color} />
      <pointLight position={[0, 2, 3]} intensity={5} color={color} distance={8} />
    </>
  );
}

// ========== SCENE MAP ==========

const SCENE_MAP: Record<string, React.FC> = {
  'rose': SceneRose,
  'heart': SceneHeart,
  'crown': SceneCrown,
  'diamond': SceneDiamond,
  'fire': SceneFire,
  'car': SceneCar,
  'money': SceneMoney,
  'coin': SceneCoin,
  'rocket': SceneRocket,
  'bomb': SceneBomb,
  'trophy': SceneTrophy,
  'police': ScenePolice,
  'snow': SceneSnow,
  'star': SceneStar,
};

// ========== OVERLAY ==========

interface Gift3DOverlayProps {
  giftName: string;
  giftIcon: string;
  giftValue: number;
  duration: number;
  onComplete: () => void;
}

export function Gift3DOverlay({ giftName, giftIcon, giftValue, duration, onComplete }: Gift3DOverlayProps) {
  const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
  const sceneType = detectScene(giftName, giftIcon);
  const SceneComponent = SCENE_MAP[sceneType];
  const soundPlayed = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('active'), 100);
    const t2 = setTimeout(() => setPhase('exit'), (duration - 0.6) * 1000);
    const t3 = setTimeout(onComplete, duration * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onComplete]);

  // Play sound once
  useEffect(() => {
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      playGiftSound(giftName, giftIcon, giftValue);
    }
  }, [giftName, giftIcon, giftValue]);

  const tierColor = giftValue >= 50000 ? '#ffd700' : giftValue >= 10000 ? '#ff3b5c' : giftValue >= 2500 ? '#f59e0b' : giftValue >= 500 ? '#a855f7' : '#00e5ff';

  return createPortal(
    <div className={`gift-3d-overlay g3d-${phase}`}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={['#080c14']} />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <Environment preset="city" />
        <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={8} blur={2} />
        
        <Suspense fallback={null}>
          {SceneComponent ? <SceneComponent /> : <SceneDefault color={tierColor} />}
        </Suspense>
      </Canvas>

      {/* Gift info overlay */}
      <div className="g3d-info">
        <div className="g3d-name" style={{ textShadow: `0 0 20px ${tierColor}` }}>
          {giftIcon} {giftName.replace(/_/g, ' ')}
        </div>
        <div className="g3d-cost" style={{ color: tierColor }}>
          {giftValue.toLocaleString()} coins • {duration}s
        </div>
        <div className="g3d-scene">{sceneType}</div>
      </div>

      {/* Progress bar */}
      <div className="g3d-progress">
        <div className="g3d-progress-bar" style={{ background: tierColor, animationDuration: `${duration}s` }} />
      </div>
    </div>,
    document.body
  );
}
