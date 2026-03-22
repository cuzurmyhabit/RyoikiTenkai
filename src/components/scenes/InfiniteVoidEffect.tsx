import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VS = `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = `
uniform float uTime;
uniform float uStrength;
varying vec3 vLocal;

void main() {
  float cyl = length(vLocal.xz);
  float h = abs(vLocal.y);
  float verticalMask = smoothstep(2.25, 0.15, h);
  float core = smoothstep(0.42, 0.0, cyl) * verticalMask;
  float halo = smoothstep(0.55, 0.12, cyl) * verticalMask * 0.55;
  float ribs = sin(h * 14.0 - uTime * 6.0) * 0.5 + 0.5;
  float flick = 0.82 + 0.18 * ribs;
  float breathe = 0.9 + 0.1 * sin(uTime * 3.8);
  vec3 col = vec3(1.0, 0.99, 1.0);
  float i = (core * 2.4 + halo) * flick * breathe * (0.75 + uStrength * 0.55);
  gl_FragColor = vec4(col * i, 1.0);
}
`;

type Props = {
  active: boolean;
  strength: number;
  getOffset: () => { x: number; y: number };
};

const RING_N = 2800;

export function InfiniteVoidEffect({ active, strength, getOffset }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uStrength: { value: 1 },
    }),
    [],
  );

  const ringPos = useMemo(() => {
    const arr = new Float32Array(RING_N * 3);
    for (let i = 0; i < RING_N; i++) {
      const a = (i / RING_N) * Math.PI * 2;
      const jitter = 0.92 + Math.random() * 0.2;
      arr[i * 3] = Math.cos(a) * 1.55 * jitter;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.35;
      arr[i * 3 + 2] = Math.sin(a) * 1.55 * jitter;
    }
    return arr;
  }, []);

  useFrame((state) => {
    const g = groupRef.current;
    const mesh = meshRef.current;
    const ring = ringRef.current;
    const mat = matRef.current;
    if (!g || !mesh || !ring || !mat || !active) return;

    const t = state.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uStrength.value = THREE.MathUtils.lerp(
      mat.uniforms.uStrength.value,
      strength,
      0.08,
    );

    const pulse = 1 + Math.sin(t * 4.2) * 0.055;
    const sx = (0.3 + strength * 0.14) * pulse;
    const sy = (1.92 + strength * 0.28) * pulse * (0.96 + strength * 0.06);
    mesh.scale.lerp(new THREE.Vector3(sx, sy, sx), 0.09);

    ring.rotation.y = t * 0.55;
    ring.scale.lerp(
      new THREE.Vector3(1.05 + strength * 0.12, 1, 1.05 + strength * 0.12),
      0.06,
    );

    const o = getOffset();
    g.position.lerp(
      new THREE.Vector3(o.x * 0.52, o.y * 0.46, 0.35),
      0.07,
    );
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <pointLight color="#ffffff" intensity={5 + strength * 6} distance={18} decay={2} />
      <pointLight color="#a5f3fc" intensity={2 + strength * 2.5} position={[0, 0, 2]} />
      <mesh ref={meshRef} scale={[0.32, 1.95, 0.32]}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VS}
          fragmentShader={FS}
          uniforms={uniforms}
        />
      </mesh>
      <points ref={ringRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ringPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ecfeff"
          size={0.048}
          sizeAttenuation
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
