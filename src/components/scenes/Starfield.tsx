import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Technique } from '../../technique';

const NEAR_COUNT = 9000;
const FAR_COUNT = 12000;

type Props = {
  technique: Technique;
  strength: number;
};

function accentForTechnique(t: Technique): string {
  switch (t) {
    case 'hollowPurple':
      return '#c084fc';
    case 'red':
      return '#f87171';
    case 'infiniteVoid':
      return '#22d3ee';
    case 'malevolentShrine':
      return '#4ade80';
    default:
      return '#ffffff';
  }
}

function nearSpeedBase(t: Technique): number {
  switch (t) {
    case 'hollowPurple':
      return 1.55;
    case 'red':
      return 2.15;
    case 'infiniteVoid':
      return 3.05;
    case 'malevolentShrine':
      return 1.9;
    default:
      return 0.65;
  }
}

function farSpeedBase(t: Technique): number {
  switch (t) {
    case 'hollowPurple':
      return 0.95;
    case 'red':
      return 1.25;
    case 'infiniteVoid':
      return 1.75;
    case 'malevolentShrine':
      return 1.1;
    default:
      return 0.32;
  }
}

export function Starfield({ technique, strength }: Props) {
  const nearRef = useRef<THREE.Points>(null);
  const farRef = useRef<THREE.Points>(null);
  const nearMatRef = useRef<THREE.PointsMaterial>(null);
  const farMatRef = useRef<THREE.PointsMaterial>(null);

  const nearPositions = useMemo(() => {
    const arr = new Float32Array(NEAR_COUNT * 3);
    for (let i = 0; i < NEAR_COUNT; i++) {
      const r = 10 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const farPositions = useMemo(() => {
    const arr = new Float32Array(FAR_COUNT * 3);
    for (let i = 0; i < FAR_COUNT; i++) {
      const r = 26 + Math.random() * 52;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const accent = useMemo(() => accentForTechnique(technique), [technique]);

  useFrame((state, dt) => {
    const nearPts = nearRef.current;
    const farPts = farRef.current;
    if (!nearPts || !farPts) return;

    const active = technique !== 'idle';
    const tBoost = 1 + strength * 1.15;

    const nearSpeed = nearSpeedBase(technique) * tBoost;
    const farSpeed = farSpeedBase(technique) * (1 + strength * 0.75);

    // 레이어별 회전 속도(깊이감)
    nearPts.rotation.y += dt * 0.011 * nearSpeed;
    nearPts.rotation.x += dt * 0.0026 * nearSpeed;
    farPts.rotation.y += dt * 0.007 * farSpeed;
    farPts.rotation.x += dt * 0.0014 * farSpeed;

    // “반짝” 느낌: 회전은 유지하되 아주 약한 드리프트
    const t = state.clock.elapsedTime;
    nearPts.position.x = Math.sin(t * 0.28) * 0.06 * (active ? 1 : 0.4);
    nearPts.position.y = Math.cos(t * 0.22) * 0.05 * (active ? 1 : 0.4);
    farPts.position.x = Math.sin(t * 0.19) * 0.035 * (active ? 1 : 0.4);
    farPts.position.y = Math.cos(t * 0.17) * 0.03 * (active ? 1 : 0.4);

    if (nearMatRef.current) {
      nearMatRef.current.opacity = (active ? 0.8 : 0.55) + strength * 0.22;
      nearMatRef.current.size = 0.06 + strength * 0.03;
    }
    if (farMatRef.current) {
      farMatRef.current.opacity = (active ? 0.6 : 0.4) + strength * 0.16;
      farMatRef.current.size = 0.04 + strength * 0.02;
    }
  });

  return (
    <>
      <points ref={nearRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={nearMatRef}
          color={accent}
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.65}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={farRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[farPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={farMatRef}
          color={accent}
          size={0.04}
          sizeAttenuation
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
