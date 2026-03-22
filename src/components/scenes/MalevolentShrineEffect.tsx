import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Props = {
  active: boolean;
  strength: number;
  getOffset: () => { x: number; y: number };
};

function sampleTorus(R: number, r: number, target: number): Float32Array {
  const torus = new THREE.TorusGeometry(R, r, 32, 600);
  const pos = torus.attributes.position.array as Float32Array;
  const nVerts = pos.length / 3;
  const step = Math.max(1, Math.floor(nVerts / target));
  const out: number[] = [];
  for (let i = 0; i < nVerts; i += step) {
    out.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  }
  torus.dispose();
  return new Float32Array(out);
}

const SPARK_N = 4200;

export function MalevolentShrineEffect({ active, strength, getOffset }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const mainRef = useRef<THREE.Points>(null);
  const innerRef = useRef<THREE.Points>(null);
  const sparkRef = useRef<THREE.Points>(null);

  const baseMain = useMemo(() => sampleTorus(1.52, 0.44, 9500), []);
  const baseInner = useMemo(() => sampleTorus(0.92, 0.22, 5200), []);
  const posMain = useMemo(() => new Float32Array(baseMain), [baseMain]);
  const posInner = useMemo(() => new Float32Array(baseInner), [baseInner]);

  const sparkBase = useMemo(() => {
    const arr = new Float32Array(SPARK_N * 3);
    for (let i = 0; i < SPARK_N; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = 1.1 + Math.random() * 2.4;
      const y = (Math.random() - 0.5) * 2.2;
      arr[i * 3] = Math.cos(a) * rad;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * rad;
    }
    return arr;
  }, []);
  const sparkWork = useMemo(() => new Float32Array(sparkBase), [sparkBase]);

  useFrame((state) => {
    const g = groupRef.current;
    const main = mainRef.current;
    const inner = innerRef.current;
    const sparks = sparkRef.current;
    if (!g || !main || !inner || !sparks || !active) return;

    const t = state.clock.elapsedTime;
    const spin = 0.18 + strength * 0.28;

    main.rotation.x = Math.sin(t * 0.25) * 0.1;
    main.rotation.y = t * spin;
    inner.rotation.x = Math.sin(t * 0.33 + 1) * 0.12;
    inner.rotation.y = -t * (spin * 1.15);

    sparks.rotation.y = t * 0.08;

    const o = getOffset();
    g.position.lerp(
      new THREE.Vector3(o.x * 0.62, o.y * 0.52, 0),
      0.06,
    );

    const marr = main.geometry.attributes.position.array as Float32Array;
    const lenM = Math.min(marr.length, baseMain.length);
    for (let i = 0; i < lenM; i += 3) {
      const j = Math.sin(t * 2.8 + i * 0.018) * 0.035;
      marr[i] = baseMain[i] + j;
      marr[i + 1] =
        baseMain[i + 1] + Math.cos(t * 2.1 + i * 0.014) * 0.028;
      marr[i + 2] = baseMain[i + 2] + Math.sin(t * 1.4 + i * 0.011) * 0.02;
    }
    main.geometry.attributes.position.needsUpdate = true;

    const iarr = inner.geometry.attributes.position.array as Float32Array;
    const lenI = Math.min(iarr.length, baseInner.length);
    for (let i = 0; i < lenI; i += 3) {
      const j = Math.sin(t * 3.5 + i * 0.02) * 0.022;
      iarr[i] = baseInner[i] + j;
      iarr[i + 1] = baseInner[i + 1] + Math.sin(t * 2.6 + i * 0.016) * 0.018;
      iarr[i + 2] = baseInner[i + 2] + j * 0.5;
    }
    inner.geometry.attributes.position.needsUpdate = true;

    const sarr = sparks.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < SPARK_N; i++) {
      const ix = i * 3;
      const ang = t * 0.4 + i * 0.01;
      const wobble = Math.sin(ang) * 0.08;
      sarr[ix] = sparkBase[ix] + wobble;
      sarr[ix + 1] = sparkBase[ix + 1] + Math.sin(t * 2 + i) * 0.04;
      sarr[ix + 2] = sparkBase[ix + 2] + Math.cos(ang * 0.7) * 0.08;
    }
    sparks.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <pointLight color="#f8fafc" intensity={2.5 + strength * 3} distance={14} decay={2} />
      <points ref={mainRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posMain, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.038}
          sizeAttenuation
          transparent
          opacity={0.97}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={innerRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posInner, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#e0f2fe"
          size={0.032}
          sizeAttenuation
          transparent
          opacity={0.88}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={sparkRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkWork, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#bae6fd"
          size={0.028}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
