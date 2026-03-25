import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Technique } from '../../technique';

type Props = {
  visible: boolean;
  color?: string;
  technique: Technique;
};

function countForTechnique(t: Technique): number {
  switch (t) {
    case 'infiniteVoid':
      return 240;
    case 'hollowPurple':
      return 200;
    case 'red':
      return 200;
    case 'malevolentShrine':
      return 220;
    case 'idle':
      return 130;
    default:
      return 0;
  }
}

export function FloatingSquares({
  visible,
  color = '#5eead4',
  technique,
}: Props) {
  const count = visible ? countForTechnique(technique) : 0;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.67,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );

  const seeds = useMemo(() => {
    return Array.from({ length: Math.max(count, 1) }, () => ({
      x: (Math.random() - 0.5) * 32,
      y: (Math.random() - 0.5) * 20,
      z: -5 - Math.random() * 28,
      s: 0.1 + Math.random() * 0.32,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      spd: 0.2 + Math.random() * 0.55,
    }));
  }, [count]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || !visible || count === 0) return;
    const t = state.clock.elapsedTime;
    const boost =
      technique === 'infiniteVoid'
        ? 2.2
        : technique === 'hollowPurple'
          ? 1.55
          : technique === 'malevolentShrine'
            ? 1.45
            : 1;
    seeds.forEach((seed, i) => {
      dummy.position.set(
        seed.x + Math.sin(t * seed.spd * boost + i) * 0.55,
        seed.y + Math.cos(t * seed.spd * 0.85 * boost) * 0.45,
        seed.z + Math.sin(t * 0.28 * boost + i * 0.09) * 0.65,
      );
      dummy.rotation.set(
        seed.rx + t * 0.22 * boost,
        seed.ry + t * 0.16 * boost,
        t * 0.05,
      );
      dummy.scale.setScalar(seed.s * (technique === 'infiniteVoid' ? 1.15 : 1));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!visible || count === 0) return null;

  return <instancedMesh ref={ref} args={[geo, mat, count]} />;
}
