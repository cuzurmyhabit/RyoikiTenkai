import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Technique } from '../../technique';

const TUNNEL_N = 9000;
const Z_MIN = -58;
const Z_MAX = 6;

type Props = {
  active: boolean;
  technique: Technique;
  strength: number;
  getOffset: () => { x: number; y: number };
};

function tunnelColor(t: Technique): string {
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

function tunnelSpeedBase(t: Technique): number {
  switch (t) {
    case 'hollowPurple':
      return 18;
    case 'red':
      return 23;
    case 'infiniteVoid':
      return 30;
    case 'malevolentShrine':
      return 20;
    default:
      return 10;
  }
}

export function WarpTunnel({ active, technique, strength, getOffset }: Props) {
  const ptsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const init = useMemo(() => {
    const angles = new Float32Array(TUNNEL_N);
    const radialBase = new Float32Array(TUNNEL_N);
    const zs = new Float32Array(TUNNEL_N);
    const positions = new Float32Array(TUNNEL_N * 3);

    for (let i = 0; i < TUNNEL_N; i++) {
      angles[i] = Math.random() * Math.PI * 2;
      // 원통 폭: 안쪽에 더 몰아넣기
      radialBase[i] = Math.pow(Math.random(), 0.55) * (0.55 + Math.random() * 1.25);
      zs[i] = Z_MIN + Math.random() * (Z_MAX - Z_MIN);

      const f = (zs[i] - Z_MIN) / (Z_MAX - Z_MIN); // 0(멀리) ~ 1(가까이)
      const funnel = Math.pow(1 - f, 1.45); // 가까울수록 중심으로 수렴
      const r = radialBase[i] * funnel * 1.25;

      positions[i * 3] = Math.cos(angles[i]) * r;
      positions[i * 3 + 1] = Math.sin(angles[i]) * r;
      positions[i * 3 + 2] = zs[i];
    }

    return { angles, radialBase, zs, positions };
  }, []);

  const color = useMemo(() => tunnelColor(technique), [technique]);

  useFrame((state, dt) => {
    if (!active) return;
    const pts = ptsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const o = getOffset();
    const speed = tunnelSpeedBase(technique) * (1 + strength * 1.85);

    // 포물선 느낌: 약간 좌우로 흔들림
    const t = state.clock.elapsedTime;
    const driftX = Math.sin(t * 0.72) * (0.25 + strength * 0.55);
    const driftY = Math.cos(t * 0.61) * (0.18 + strength * 0.48);

    for (let i = 0; i < TUNNEL_N; i++) {
      init.zs[i] += dt * speed;
      if (init.zs[i] > Z_MAX) {
        init.zs[i] = Z_MIN + Math.random() * (Z_MAX - Z_MIN) * 0.12;
      }

      const f = (init.zs[i] - Z_MIN) / (Z_MAX - Z_MIN);
      const funnel = Math.pow(1 - f, 1.45);
      const r = init.radialBase[i] * funnel * 1.25;

      const ang = init.angles[i];
      arr[i * 3] = Math.cos(ang) * r + o.x * 0.9 + driftX * 0.08;
      arr[i * 3 + 1] = Math.sin(ang) * r + o.y * 0.7 + driftY * 0.08;
      arr[i * 3 + 2] = init.zs[i];
    }

    posAttr.needsUpdate = true;

    if (matRef.current) {
      matRef.current.opacity = 0.62 + strength * 0.35;
      matRef.current.size = 0.05 + strength * 0.04;
    }

    // 흐름 회전(워프의 소용돌이)
    pts.rotation.y = t * (0.08 + strength * 0.16);
    pts.rotation.x = Math.sin(t * 0.17) * (0.03 + strength * 0.08);
  });

  if (!active) return null;

  return (
    <points ref={ptsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[init.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={color}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

