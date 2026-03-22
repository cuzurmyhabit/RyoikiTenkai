import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Technique } from '../../technique';

const COUNT = 11000;

type Props = {
  /** 기법별로 회전·움직임 강도 (영상처럼 활성 시 우주가 빨라짐) */
  technique: Technique;
};

export function Starfield({ technique }: Props) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 16 + Math.random() * 48;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const speedRef = useRef(1);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;

    let target = 1;
    switch (technique) {
      case 'hollowPurple':
        target = 2.1;
        break;
      case 'red':
        target = 2.85;
        break;
      case 'infiniteVoid':
        target = 3.6;
        break;
      case 'malevolentShrine':
        target = 2.35;
        break;
      default:
        target = 1;
    }
    speedRef.current += (target - speedRef.current) * 0.04;
    pts.rotation.y += dt * 0.011 * speedRef.current;
    pts.rotation.x += dt * 0.0028 * speedRef.current;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.058}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
