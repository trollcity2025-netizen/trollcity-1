import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface BattleThreeAnimationsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  type: 'timer' | 'sudden_death' | 'box_added' | 'crown_earned' | 'streak_achieved';
  isActive: boolean;
  onComplete?: () => void;
}

// Timer Animation - 3D Countdown
const createTimerAnimation = (container: HTMLDivElement, timeLeft: number, isSuddenDeath: boolean) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Create 3D text geometry for the timer
  const loader = new THREE.FontLoader();
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Create glowing ring around timer
  const ringGeometry = new THREE.TorusGeometry(3, 0.1, 16, 100);
  const ringMaterial = new THREE.MeshBasicMaterial({ 
    color: isSuddenDeath ? 0xff0000 : 0xffa500,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  scene.add(ring);

  // Create particle system for sudden death
  const particles: THREE.Mesh[] = [];
  if (isSuddenDeath) {
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    
    for (let i = 0; i < 50; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5
      );
      particle.userData = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        )
      };
      scene.add(particle);
      particles.push(particle);
    }
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const pointLight = new THREE.PointLight(isSuddenDeath ? 0xff0000 : 0xffa500, 1, 100);
  pointLight.position.set(0, 0, 5);
  scene.add(pointLight);

  camera.position.z = 5;

  let animationId: number;
  const animate = () => {
    animationId = requestAnimationFrame(animate);

    // Rotate ring
    ring.rotation.z += isSuddenDeath ? 0.1 : 0.02;
    ring.rotation.x += 0.01;

    // Pulse effect for sudden death
    if (isSuddenDeath) {
      const scale = 1 + Math.sin(Date.now() * 0.01) * 0.1;
      ring.scale.set(scale, scale, scale);
      
      // Animate particles
      particles.forEach(particle => {
        particle.position.add(particle.userData.velocity);
        if (particle.position.length() > 5) {
          particle.position.setLength(0.5);
        }
      });
    }

    renderer.render(scene, camera);
  };

  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
    updateTime: (newTimeLeft: number) => {
      const newMinutes = Math.floor(newTimeLeft / 60);
      const newSeconds = newTimeLeft % 60;
      // Update animation based on new time
      ringMaterial.color.setHex(newTimeLeft <= 10 ? 0xff0000 : 0xffa500);
    }
  };
};

// Sudden Death Animation - Lightning and storm effects
const createSuddenDeathAnimation = (container: HTMLDivElement) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Lightning bolts
  const lightningGroup = new THREE.Group();
  scene.add(lightningGroup);

  const createLightning = () => {
    const points: THREE.Vector3[] = [];
    let x = 0;
    let y = 5;
    
    while (y > -5) {
      points.push(new THREE.Vector3(x, y, 0));
      x += (Math.random() - 0.5) * 2;
      y -= 0.5;
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 3
    });
    
    return new THREE.Line(geometry, material);
  };

  // Create electric aura
  const auraGeometry = new THREE.SphereGeometry(2, 32, 32);
  const auraMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.3,
    wireframe: true
  });
  const aura = new THREE.Mesh(auraGeometry, auraMaterial);
  scene.add(aura);

  // Flash overlay
  const flashGeometry = new THREE.PlaneGeometry(20, 20);
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0
  });
  const flash = new THREE.Mesh(flashGeometry, flashMaterial);
  flash.position.z = 1;
  scene.add(flash);

  camera.position.z = 5;

  let animationId: number;
  let frameCount = 0;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    frameCount++;

    // Random lightning
    if (frameCount % 10 === 0 && Math.random() > 0.5) {
      lightningGroup.clear();
      for (let i = 0; i < 3; i++) {
        const lightning = createLightning();
        lightning.position.x = (Math.random() - 0.5) * 10;
        lightning.position.z = (Math.random() - 0.5) * 5;
        lightningGroup.add(lightning);
      }
      
      // Flash effect
      flashMaterial.opacity = 0.8;
    }

    // Fade flash
    if (flashMaterial.opacity > 0) {
      flashMaterial.opacity -= 0.1;
    }

    // Rotate and pulse aura
    aura.rotation.y += 0.05;
    aura.rotation.x += 0.02;
    const scale = 1 + Math.sin(Date.now() * 0.01) * 0.2;
    aura.scale.set(scale, scale, scale);

    // Change aura color
    const hue = (Date.now() * 0.001) % 1;
    auraMaterial.color.setHSL(hue, 1, 0.5);

    renderer.render(scene, camera);
  };

  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
};

// Box Added Animation - 3D box appearing
const createBoxAddedAnimation = (container: HTMLDivElement, boxNumber: number) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Create 3D box
  const boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const boxMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffd700,
    emissive: 0xffa500,
    emissiveIntensity: 0.5,
    shininess: 100
  });
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.scale.set(0, 0, 0);
  scene.add(box);

  // Box edges glow
  const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  box.add(edges);

  // Sparkle particles
  const sparkles: THREE.Mesh[] = [];
  const sparkleGeometry = new THREE.OctahedronGeometry(0.1);
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

  for (let i = 0; i < 20; i++) {
    const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
    sparkle.position.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    );
    sparkle.userData = {
      rotationSpeed: {
        x: Math.random() * 0.1,
        y: Math.random() * 0.1,
        z: Math.random() * 0.1
      }
    };
    scene.add(sparkle);
    sparkles.push(sparkle);
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffd700, 2, 100);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xff00ff, 1, 100);
  pointLight2.position.set(-5, -5, 5);
  scene.add(pointLight2);

  camera.position.z = 5;

  let animationId: number;
  let scale = 0;
  const targetScale = 1;

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    // Scale up animation
    if (scale < targetScale) {
      scale += 0.05;
      box.scale.set(scale, scale, scale);
    }

    // Rotate box
    box.rotation.x += 0.02;
    box.rotation.y += 0.03;

    // Animate sparkles
    sparkles.forEach(sparkle => {
      sparkle.rotation.x += sparkle.userData.rotationSpeed.x;
      sparkle.rotation.y += sparkle.userData.rotationSpeed.y;
      sparkle.rotation.z += sparkle.userData.rotationSpeed.z;
      
      // Move sparkles outward
      sparkle.position.multiplyScalar(1.01);
      
      // Reset if too far
      if (sparkle.position.length() > 10) {
        sparkle.position.setLength(0.5);
      }
    });

    // Pulse emissive
    boxMaterial.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;

    renderer.render(scene, camera);
  };

  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
};

// Crown Earned Animation
const createCrownAnimation = (container: HTMLDivElement) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Create crown shape using multiple geometries
  const crownGroup = new THREE.Group();

  // Crown base
  const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.3, 8);
  const crownMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffd700,
    emissive: 0xffa500,
    emissiveIntensity: 0.3,
    shininess: 100
  });
  const base = new THREE.Mesh(baseGeometry, crownMaterial);
  crownGroup.add(base);

  // Crown points
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const pointGeometry = new THREE.ConeGeometry(0.3, 1, 4);
    const point = new THREE.Mesh(pointGeometry, crownMaterial);
    point.position.x = Math.cos(angle) * 1.2;
    point.position.z = Math.sin(angle) * 1.2;
    point.position.y = 0.5;
    crownGroup.add(point);
  }

  scene.add(crownGroup);

  // Sparkles
  const sparkles: THREE.Mesh[] = [];
  const sparkleGeometry = new THREE.OctahedronGeometry(0.15);
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  for (let i = 0; i < 30; i++) {
    const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
    sparkle.position.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 5
    );
    scene.add(sparkle);
    sparkles.push(sparkle);
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffd700, 2, 100);
  pointLight.position.set(0, 5, 5);
  scene.add(pointLight);

  camera.position.z = 6;

  let animationId: number;
  let time = 0;

  const animate = () => {
    animationId = requestAnimationFrame(animate);
    time += 0.05;

    // Float animation
    crownGroup.position.y = Math.sin(time) * 0.3;
    crownGroup.rotation.y += 0.02;

    // Scale pulse
    const scale = 1 + Math.sin(time * 2) * 0.05;
    crownGroup.scale.set(scale, scale, scale);

    // Sparkle animation
    sparkles.forEach((sparkle, i) => {
      sparkle.rotation.x += 0.05;
      sparkle.rotation.y += 0.05;
      sparkle.position.y += Math.sin(time + i) * 0.02;
      
      // Twinkle
      sparkle.scale.setScalar(0.5 + Math.sin(time * 3 + i) * 0.5);
    });

    renderer.render(scene, camera);
  };

  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
};

// Streak Achieved Animation - Fire trail
const createStreakAnimation = (container: HTMLDivElement, streakCount: number) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Create fire particles
  const fireParticles: THREE.Mesh[] = [];
  const fireColors = [0xff4500, 0xff8c00, 0xffd700, 0xff0000];

  for (let i = 0; i < 100; i++) {
    const geometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: fireColors[Math.floor(Math.random() * fireColors.length)],
      transparent: true,
      opacity: 0.8
    });
    const particle = new THREE.Mesh(geometry, material);
    
    particle.position.set(
      (Math.random() - 0.5) * 10,
      -5 + Math.random() * 2,
      (Math.random() - 0.5) * 5
    );
    
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        0.05 + Math.random() * 0.1,
        (Math.random() - 0.5) * 0.1
      ),
      life: 1.0
    };
    
    scene.add(particle);
    fireParticles.push(particle);
  }

  camera.position.z = 8;
  camera.position.y = 2;

  let animationId: number;

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    fireParticles.forEach(particle => {
      // Move up
      particle.position.add(particle.userData.velocity);
      
      // Reduce life
      particle.userData.life -= 0.01;
      
      // Update opacity
      const material = particle.material as THREE.MeshBasicMaterial;
      material.opacity = particle.userData.life;
      
      // Scale down
      const scale = particle.userData.life;
      particle.scale.setScalar(scale);

      // Reset if dead
      if (particle.userData.life <= 0) {
        particle.position.y = -5;
        particle.userData.life = 1.0;
        material.opacity = 0.8;
        particle.scale.setScalar(1);
      }
    });

    renderer.render(scene, camera);
  };

  animate();

  return {
    cleanup: () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
};

export const BattleThreeAnimations: React.FC<BattleThreeAnimationsProps> = ({
  containerRef,
  type,
  isActive,
  onComplete
}) => {
  const animationRef = useRef<{ cleanup: () => void; updateTime?: (time: number) => void } | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Clean up any existing animation
    if (animationRef.current) {
      animationRef.current.cleanup();
    }

    // Create new animation based on type
    switch (type) {
      case 'timer':
        animationRef.current = createTimerAnimation(container, 180, false);
        break;
      case 'sudden_death':
        animationRef.current = createSuddenDeathAnimation(container);
        break;
      case 'box_added':
        animationRef.current = createBoxAddedAnimation(container, 1);
        break;
      case 'crown_earned':
        animationRef.current = createCrownAnimation(container);
        break;
      case 'streak_achieved':
        animationRef.current = createStreakAnimation(container, 3);
        break;
    }

    // Auto-cleanup after animation duration
    const duration = type === 'timer' || type === 'sudden_death' ? 0 : 3000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (animationRef.current) {
          animationRef.current.cleanup();
          animationRef.current = null;
        }
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(timer);
        if (animationRef.current) {
          animationRef.current.cleanup();
          animationRef.current = null;
        }
      };
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.cleanup();
        animationRef.current = null;
      }
    };
  }, [isActive, type, containerRef, onComplete]);

  return null;
};

export default BattleThreeAnimations;