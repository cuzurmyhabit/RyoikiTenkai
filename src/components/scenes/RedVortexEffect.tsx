import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  active: boolean;
  strength: number;
  getOffset: () => { x: number; y: number };
};

const N_OUT = 12000;
const N_CORE = 3500;

export function RedVortexEffect({ active, strength, getOffset }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const outRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Points>(null);

  const outInit = useMemo(() => new Float32Array(N_OUT * 3), []);
  const coreInit = useMemo(() => new Float32Array(N_CORE * 3), []);

  useFrame((state) => {
    const grp = groupRef.current;
    const outPts = outRef.current;
    const corePts = coreRef.current;
    if (!grp || !outPts || !corePts || !active) return;

    const t = state.clock.elapsedTime * (1.15 + strength * 1.5);
    const o = getOffset();
    const spin = 0.62 + strength * 0.85;
    const pull = 0.04 + strength * 0.06;

    const oarr = outPts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < N_OUT; i++) {
      const f = i / N_OUT;
      const arm = i % 5;
      const spiral = f * Math.PI * 28 + arm * ((Math.PI * 2) / 5);
      const wave = Math.sin(spiral * 3 + t * 4) * 0.11;
      const r = 0.06 + f * 3.1 + wave + Math.sin(t * 2 + f * 10) * pull;
      const ang = spiral + t * spin;
      oarr[i * 3] = Math.cos(ang) * r + o.x * 0.62;
      oarr[i * 3 + 1] = Math.sin(ang) * r + o.y * 0.55;
      oarr[i * 3 + 2] = ((i % 280) / 280 - 0.5) * 1.35 + Math.sin(f * 40 + t) * 0.12;
    }
    outPts.geometry.attributes.position.needsUpdate = true;
    outPts.rotation.z = t * 0.11;

    const carr = corePts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < N_CORE; i++) {
      const f = i / N_CORE;
      const ang = f * Math.PI * 22 + t * (spin * 1.2);
      const r = 0.02 + f * 0.85 + Math.sin(t * 5 + f * 20) * 0.04;
      carr[i * 3] = Math.cos(ang) * r + o.x * 0.62;
      carr[i * 3 + 1] = Math.sin(ang) * r + o.y * 0.55;
      carr[i * 3 + 2] = ((i % 80) / 80 - 0.5) * 0.25;
    }
    corePts.geometry.attributes.position.needsUpdate = true;

    grp.position.z = Math.sin(t * 0.5) * 0.08;
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <pointLight color="#ff2200" intensity={4 + strength * 5} distance={16} decay={2} />
      <points ref={outRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outInit, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ff1a1a"
          size={0.042}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={coreRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[coreInit, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#fff5f5"
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
