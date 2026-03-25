import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Technique } from '../../technique';

const NEBULA_N = 9000;

type Props = {
  technique: Technique;
  strength: number;
  getOffset: () => { x: number; y: number };
};

function nebulaColor(t: Technique): string {
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
      return '#93c5fd';
  }
}

export function NebulaDust({ technique, strength, getOffset }: Props) {
  const ptsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(NEBULA_N * 3);
    for (let i = 0; i < NEBULA_N; i++) {
      // 구형 볼륨 + 중심에 조금 더 밀도(성운처럼)
      const u = Math.random();
      const radius = 14 + Math.pow(u, 0.55) * 46;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) * 0.58; // 디스크처럼 납작하게
      const z = radius * Math.sin(phi) * Math.sin(theta);

      // 중심으로 살짝 끌어당김(광원처럼 보이게)
      const pull = 1 - Math.pow(radius / 60, 0.9) * 0.22;

      arr[i * 3] = x * pull;
      arr[i * 3 + 1] = y * pull;
      arr[i * 3 + 2] = z * pull;
    }
    return arr;
  }, []);

  const color = useMemo(() => nebulaColor(technique), [technique]);

  useFrame((state, dt) => {
    const pts = ptsRef.current;
    const mat = matRef.current;
    if (!pts || !mat) return;

    const active = technique !== 'idle';
    const t = state.clock.elapsedTime;
    const boost = active ? 1 + strength * 1.35 : 1;

    // 부드럽게 회전하는 “먼지/성운”
    pts.rotation.y += dt * 0.02 * boost;
    pts.rotation.x += dt * 0.006 * boost;

    // 손이 움직이면 성운 중심도 약간 따라옴
    const o = getOffset();
    const tx = o.x * 0.28;
    const ty = o.y * 0.22;
    pts.position.x = THREE.MathUtils.lerp(pts.position.x, tx, 0.04);
    pts.position.y = THREE.MathUtils.lerp(pts.position.y, ty, 0.04);

    // 기법 활성 시 더 또렷하고, 미세하게 맥동
    mat.opacity = (active ? 0.36 : 0.20) + strength * (active ? 0.38 : 0.12);
    mat.opacity += Math.sin(t * 1.2) * 0.035;
    mat.size = (active ? 0.055 : 0.045) * (1 + strength * 0.55);
  });

  return (
    <points ref={ptsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.22}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

