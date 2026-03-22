import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VS = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = `
uniform float uTime;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vPosition;

float n13(vec3 p) {
  vec3 a = fract(p * 0.1031);
  a += dot(a, a.yzx + 33.33);
  return fract((a.x + a.y) * a.z);
}

void main() {
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 1.45);
  vec3 p = vPosition * 3.4;
  float t = uTime * 1.8;
  float turb =
    sin(p.x + t) * cos(p.y - t * 0.9) * sin(p.z + t * 0.7)
    + n13(p + t * 0.15) * 0.35
    + sin(p.x * 6.0 + p.y * 5.0 - t * 3.2) * 0.12;
  vec3 core = vec3(1.0, 0.98, 1.0);
  vec3 aura = vec3(0.45, 0.12, 0.92);
  vec3 edge = vec3(0.75, 0.35, 1.0);
  vec3 col = mix(core, edge, clamp(fresnel * 0.55 + turb * 0.22, 0.0, 1.0));
  col = mix(col, aura, clamp(fresnel * 0.88, 0.0, 1.0));
  float pulse = 0.88 + 0.12 * sin(uTime * 4.2);
  col *= uIntensity * pulse;
  gl_FragColor = vec4(col, 1.0);
}
`;

type Props = {
  active: boolean;
  strength: number;
  getOffset: () => { x: number; y: number };
};

const SHELL_N = 5200;

export function HollowPurpleEffect({ active, strength, getOffset }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Points>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 1 },
    }),
    [],
  );

  const shellPos = useMemo(() => {
    const arr = new Float32Array(SHELL_N * 3);
    for (let i = 0; i < SHELL_N; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const rad = 1.18 + Math.random() * 0.62;
      arr[i * 3] = rad * Math.sin(v) * Math.cos(u);
      arr[i * 3 + 1] = rad * Math.sin(v) * Math.sin(u);
      arr[i * 3 + 2] = rad * Math.cos(v);
    }
    return arr;
  }, []);

  useFrame((state) => {
    const g = groupRef.current;
    const shell = shellRef.current;
    const outer = outerRef.current;
    const inner = innerRef.current;
    const m = matRef.current;
    if (!g || !shell || !outer || !inner || !m || !active) return;

    const t = state.clock.elapsedTime;
    m.uniforms.uTime.value = t;
    const inten = 1.05 + strength * 1.15 + Math.sin(t * 2.1) * 0.06;
    m.uniforms.uIntensity.value = THREE.MathUtils.lerp(
      m.uniforms.uIntensity.value,
      inten,
      0.06,
    );

    const pulse = 1 + Math.sin(t * 3.3) * 0.045;
    const sc = (1.18 + strength * 0.72) * pulse;
    outer.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.07);
    const isc = (0.38 + strength * 0.12) * pulse;
    inner.scale.lerp(new THREE.Vector3(isc, isc, isc), 0.08);

    shell.scale.lerp(new THREE.Vector3(sc * 1.08, sc * 1.08, sc * 1.08), 0.06);
    shell.rotation.y = t * 0.22;
    shell.rotation.x = Math.sin(t * 0.31) * 0.12;

    const o = getOffset();
    g.position.lerp(
      new THREE.Vector3(o.x * 0.75, o.y * 0.58, 0),
      0.07,
    );
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <pointLight color="#a855f7" intensity={3.5 + strength * 4} distance={14} decay={2} />
      <pointLight
        color="#e9d5ff"
        position={[1.2, 0.6, 2]}
        intensity={1.8 + strength * 2}
        distance={12}
        decay={2}
      />
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.42, 48, 48]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#faf5ff"
          emissiveIntensity={5 + strength * 4}
          roughness={0.15}
          metalness={0}
        />
      </mesh>
      <mesh ref={outerRef}>
        <sphereGeometry args={[1.12, 96, 96]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VS}
          fragmentShader={FS}
          uniforms={uniforms}
        />
      </mesh>
      <points ref={shellRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPos, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#c084fc"
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
