import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Technique } from '../technique';
import { Starfield } from './scenes/Starfield';
import { FloatingSquares } from './scenes/FloatingSquares';
import { HollowPurpleEffect } from './scenes/HollowPurpleEffect';
import { RedVortexEffect } from './scenes/RedVortexEffect';
import { InfiniteVoidEffect } from './scenes/InfiniteVoidEffect';
import { MalevolentShrineEffect } from './scenes/MalevolentShrineEffect';
import { NebulaDust } from './scenes/NebulaDust';
import { WarpTunnel } from './scenes/WarpTunnel';

type Props = {
  technique: Technique;
  strength: number;
  handOffsetRef: React.MutableRefObject<{ x: number; y: number } | null>;
};

function SmoothHand({
  handOffsetRef,
  children,
}: {
  handOffsetRef: React.MutableRefObject<{ x: number; y: number } | null>;
  children: (smooth: React.MutableRefObject<{ x: number; y: number }>) => React.ReactNode;
}) {
  const smooth = useRef({ x: 0, y: 0 });
  useFrame(() => {
    const h = handOffsetRef.current;
    const tx = h?.x ?? 0;
    const ty = h?.y ?? 0;
    smooth.current.x += (tx - smooth.current.x) * 0.14;
    smooth.current.y += (ty - smooth.current.y) * 0.14;
  });
  return <>{children(smooth)}</>;
}

/** 영화같은 미세 줌·스웨이·FOV (기법 활성 시 전장감) */
function CinematicCamera({
  technique,
  strength,
}: {
  technique: Technique;
  strength: number;
}) {
  const { camera } = useThree();
  const baseZ = 8.5;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = technique !== 'idle';
    const targetZ = active ? baseZ - 0.95 - strength * 0.74 : baseZ;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.032);

    const swayX =
      Math.sin(t * (active ? 0.62 : 0.24)) * (active ? 0.22 : 0.07) *
      (1 + strength * (active ? 1.25 : 0));
    const swayY =
      Math.cos(t * 0.44) *
      (active ? 0.15 : 0.055) *
      (1 + strength * (active ? 1.15 : 0));

    // 짧게 튀는 “충격감” (기술이 켜졌을 때만)
    const shake =
      active ? (0.016 + strength * 0.05) * (0.6 + 0.4 * Math.sin(t * 8.2)) : 0;
    const shakeX = Math.sin(t * 9.1) * shake;
    const shakeY = Math.cos(t * 7.2) * shake;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, swayX + shakeX, 0.038);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, swayY + shakeY, 0.038);

    if (camera instanceof THREE.PerspectiveCamera) {
      const f = active ? 42.5 + strength * 9 : 47.2;
      camera.fov = THREE.MathUtils.lerp(camera.fov, f, 0.022);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function ExposureRig({
  technique,
  strength,
}: {
  technique: Technique;
  strength: number;
}) {
  const { gl } = useThree();
  useFrame(() => {
    const target = technique === 'idle' ? 1.02 : 1.22 + strength * 0.18;
    gl.toneMappingExposure += (target - gl.toneMappingExposure) * 0.06;
  });
  return null;
}

function PostFX({
  technique,
  strength,
}: {
  technique: Technique;
  strength: number;
}) {
  const bloomBase = useMemo(() => {
    switch (technique) {
      case 'hollowPurple':
        return { threshold: 0.1, intensity: 2.05, radius: 0.88 };
      case 'red':
        return { threshold: 0.12, intensity: 1.95, radius: 0.82 };
      case 'infiniteVoid':
        return { threshold: 0.06, intensity: 2.45, radius: 0.95 };
      case 'malevolentShrine':
        return { threshold: 0.1, intensity: 2.15, radius: 0.86 };
      default:
        return { threshold: 0.58, intensity: 0.42, radius: 0.55 };
    }
  }, [technique]);

  const active = technique !== 'idle';

  const bloom = {
    threshold: Math.max(0.02, bloomBase.threshold * (1 - strength * 0.35)),
    intensity: bloomBase.intensity * (1 + strength * (active ? 0.6 : 0.15)),
    radius: bloomBase.radius * (1 + strength * (active ? 0.25 : 0.05)),
  };

  const vignette = {
    darkness: active ? 0.66 + strength * 0.15 : 0.45,
    offset: active ? 0.28 + strength * 0.1 : 0.38,
  };

  const chromaOffset = useMemo(() => {
    const a = technique === 'idle' ? 0.00022 : 0.00115;
    const k = active ? 1 + strength * 2.2 : 1;
    return new THREE.Vector2(a * k, a * k);
  }, [technique, strength, active]);

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={bloom.threshold}
        intensity={bloom.intensity}
        radius={bloom.radius}
        mipmapBlur
      />
      <ChromaticAberration
        offset={chromaOffset}
        radialModulation
        modulationOffset={0.18}
      />
      <Vignette eskil={false} offset={vignette.offset} darkness={vignette.darkness} />
    </EffectComposer>
  );
}

function World({
  technique,
  strength,
  smoothRef,
}: {
  technique: Technique;
  strength: number;
  smoothRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const readOffset = () => smoothRef.current;

  return (
    <>
      <ExposureRig technique={technique} strength={strength} />
      <CinematicCamera technique={technique} strength={strength} />
      <color attach="background" args={['#010102']} />
      <fog attach="fog" args={['#02010a', 8, 58]} />
      <ambientLight intensity={0.06 + strength * 0.06} />
      <pointLight
        position={[5, 7, 9]}
        intensity={0.42 + strength * 0.22}
        color="#e8e4ff"
      />
      <Starfield technique={technique} strength={strength} />
      <NebulaDust technique={technique} strength={strength} getOffset={readOffset} />
      <FloatingSquares
        visible={true}
        color={
          technique === 'infiniteVoid'
            ? '#22d3ee'
            : technique === 'malevolentShrine'
              ? '#7dd3fc'
              : technique === 'red'
                ? '#f87171'
                : technique === 'hollowPurple'
                  ? '#c084fc'
                  : '#cbd5e1'
        }
        technique={technique}
      />
      <HollowPurpleEffect
        active={technique === 'hollowPurple'}
        strength={strength}
        getOffset={readOffset}
      />
      <RedVortexEffect
        active={technique === 'red'}
        strength={strength}
        getOffset={readOffset}
      />
      <InfiniteVoidEffect
        active={technique === 'infiniteVoid'}
        strength={strength}
        getOffset={readOffset}
      />
      <MalevolentShrineEffect
        active={technique === 'malevolentShrine'}
        strength={strength}
        getOffset={readOffset}
      />
      <WarpTunnel
        active={technique !== 'idle'}
        technique={technique}
        strength={strength}
        getOffset={readOffset}
      />
      <PostFX technique={technique} strength={strength} />
    </>
  );
}

export function MainCanvas({ technique, strength, handOffsetRef }: Props) {
  return (
    <div className="main-canvas-wrap">
      <Canvas
        camera={{ position: [0, 0, 8.5], fov: 47.2 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.06,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SmoothHand handOffsetRef={handOffsetRef}>
            {(smooth) => (
              <World
                technique={technique}
                strength={strength}
                smoothRef={smooth}
              />
            )}
          </SmoothHand>
        </Suspense>
      </Canvas>
    </div>
  );
}
