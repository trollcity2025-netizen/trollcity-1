import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, MeshTransmissionMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { GiftInstance, RARITY_COLORS } from '@/types/gifts';

interface GiftModelProps {
  gift: GiftInstance;
}

// Procedural 3D gift shapes based on gift name
const GiftGeometry: React.FC<{ giftName: string; color: string }> = ({ giftName, color }) => {
  const lowerName = giftName.toLowerCase();
  
  // Heart shape
  if (lowerName.includes('heart')) {
    return (
      <mesh>
        <torusGeometry args={[0.5, 0.2, 16, 32]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.6}
          thickness={0.5}
          roughness={0.1}
          metalness={0.8}
          envMapIntensity={1.5}
        />
      </mesh>
    );
  }
  
  // Star shape
  if (lowerName.includes('star')) {
    return (
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.6, 0]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.4}
          thickness={0.3}
          roughness={0.1}
          metalness={0.9}
          envMapIntensity={2}
        />
      </mesh>
    );
  }
  
  // Diamond/Crown
  if (lowerName.includes('diamond') || lowerName.includes('crown')) {
    return (
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.5, 1]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.7}
          thickness={0.8}
          roughness={0.05}
          metalness={1}
          envMapIntensity={2.5}
        />
      </mesh>
    );
  }
  
  // Dragon/Phoenix
  if (lowerName.includes('dragon') || lowerName.includes('phoenix')) {
    return (
      <group>
        <mesh>
          <dodecahedronGeometry args={[0.5, 0]} />
          <MeshTransmissionMaterial
            color={color}
            transmission={0.3}
            thickness={0.5}
            roughness={0.2}
            metalness={0.7}
            emissive={color}
            emissiveIntensity={0.5}
          />
        </mesh>
        <Sparkles count={30} scale={1.5} size={3} speed={0.5} color={color} />
      </group>
    );
  }
  
  // Rose
  if (lowerName.includes('rose')) {
    return (
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.5}
          thickness={0.4}
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
    );
  }
  
  // Trophy
  if (lowerName.includes('trophy')) {
    return (
      <mesh>
        <cylinderGeometry args={[0.3, 0.5, 0.8, 32]} />
        <MeshTransmissionMaterial
          color={color}
          transmission={0.4}
          thickness={0.5}
          roughness={0.1}
          metalness={0.9}
          envMapIntensity={1.5}
        />
      </mesh>
    );
  }
  
  // Galaxy
  if (lowerName.includes('galaxy')) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <MeshTransmissionMaterial
            color="#8B5CF6"
            transmission={0.8}
            thickness={1}
            roughness={0}
            metalness={0.3}
            ior={2.5}
          />
        </mesh>
        <Sparkles count={50} scale={2} size={4} speed={0.3} color="#C4B5FD" />
      </group>
    );
  }
  
  // Default - gift box
  return (
    <mesh>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <MeshTransmissionMaterial
        color={color}
        transmission={0.5}
        thickness={0.3}
        roughness={0.2}
        metalness={0.7}
      />
    </mesh>
  );
};

// Main GiftModel component
export const GiftModel: React.FC<GiftModelProps> = ({ gift }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hoverOffset] = useState(() => Math.random() * Math.PI * 2);
  const color = RARITY_COLORS[gift.rarity] || '#9CA3AF';
  
  useFrame((state) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    switch (gift.animationType) {
      case 'spin':
        groupRef.current.rotation.y = time * 2 + hoverOffset;
        break;
      case 'orbit':
        groupRef.current.position.x = Math.sin(time + hoverOffset) * 0.5;
        groupRef.current.position.z = Math.cos(time + hoverOffset) * 0.3;
        groupRef.current.rotation.y = time * 1.5;
        break;
      case 'drop':
        groupRef.current.position.y = Math.sin(time * 3) * 0.2;
        break;
      case 'burst':
        groupRef.current.scale.setScalar(1 + Math.sin(time * 5) * 0.2);
        break;
      case 'fireworks':
        groupRef.current.position.y = 0.5 + Math.sin(time * 4) * 0.3;
        groupRef.current.rotation.y = time * 2;
        break;
      case 'spotlight':
        groupRef.current.position.y = 0.3 + Math.sin(time * 2) * 0.15;
        groupRef.current.rotation.y = time;
        break;
      case 'float':
      default:
        // Default float handled by Float component
        groupRef.current.rotation.y = time * 0.5;
        break;
    }
  });
  
  return (
    <group ref={groupRef} position={[gift.position.x, gift.position.y, gift.position.z]}>
      <Float
        speed={2}
        rotationIntensity={0.5}
        floatIntensity={0.5}
        floatingRange={[-0.1, 0.1]}
      >
        <GiftGeometry giftName={gift.gift?.name || 'Gift'} color={color} />
        
        {/* Glow effect based on rarity */}
        <pointLight color={color} intensity={2} distance={3} />
      </Float>
      
      {/* Sparkles for rarer gifts */}
      {['rare', 'epic', 'legendary', 'mythic'].includes(gift.rarity) && (
        <Sparkles
          count={gift.rarity === 'mythic' ? 50 : gift.rarity === 'legendary' ? 40 : 25}
          scale={2}
          size={gift.rarity === 'mythic' ? 4 : 3}
          speed={0.4}
          color={color}
        />
      )}
    </group>
  );
};

export default GiftModel;
