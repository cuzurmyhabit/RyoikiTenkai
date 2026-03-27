# 손 제스처로 조작하는 Three.js 우주 이펙트 (react-three/fiber + MediaPipe)

이 글에서는 손 제스처를 `technique` / `strength`로 변환하고, 그 값을 Three.js 씬의 파라미터(카메라/포스트FX/파티클)로 연결해 “우주 같고 웅장한 연출”을 만드는 과정을 정리합니다.

특히, “많은 것들이 일어나는” 느낌을 만들기 위해 배경 레이어(별/먼지) + 이벤트 레이어(워프 터널)를 분리하고, 기법이 활성화될 때만 연출 강도를 올리는 구조로 구현했습니다.

---

## 실행 방법(캡처용)

```bash
npm install
npm run dev
```

브라우저에서 카메라 권한을 허용하면, 하단에 손 미리보기(랜드마크)가 보이고 메인 캔버스에 우주 이펙트가 표시됩니다.

## 1. 목표: 무엇이 ‘우주감’인가?

우주감/웅장함은 단일 요소가 아니라 여러 레이어의 조합으로 만들어집니다.

- 배경: 별/먼지가 촘촘해야 “깊이감”이 생김
- 이벤트: 기법이 켜질 때 전방으로 뭔가가 “일어나는” 느낌이 있어야 몰입감이 생김
- 연출: 카메라 줌/스웨이/충격(약간의 흔들림) + 포스트프로세싱이 전장을 키움

그래서 이 프로젝트는 씬을 “레이어”로 나눴습니다.

---

## 2. 입력 파이프라인: HandLandmarker → technique/strength

### 2.1 손 랜드마크 감지 (실시간 VIDEO 모드)

`HandCamera`에서는 `@mediapipe/tasks-vision`의 `HandLandmarker`를 로드하고, `detectForVideo(video, performance.now())`로 랜드마크를 얻습니다.

핵심은 `requestAnimationFrame` 루프로 매 프레임 갱신한다는 점입니다.

```ts
const result = lm.detectForVideo(video, performance.now());
const landmarks = result.landmarks[0] as NormalizedLandmark[] | undefined;
...
const raw = resolveGesture(landmarks);
```

또한 랜드마크가 없을 때는 즉시 `idle`로 회귀하도록 처리합니다.

```ts
if (!landmarks) {
  stabRef.current = { candidate: 'idle', count: 0, strengthEma: 0 };
  onHandOffsetRef.current(null);
  if (lastTechRef.current !== 'idle') {
    lastTechRef.current = 'idle';
    lastStrengthRef.current = 0;
    onTechniqueRef.current('idle', 0);
  }
  return;
}
```

### 2.2 technique / strength 매핑: `resolveGesture()`

`resolveGesture()`는 손가락 “펴짐/접힘”과 손가락 끝 거리/교차 판정을 조합해 `Technique`을 결정하고, 확실도가 높을수록 `strength`를 더 키우는 방식입니다.

특히 무량공처(`infiniteVoid`)는 검지·중지가 교차하고 끝마디가 가까운지(임계값)로 판정합니다.

```ts
const voidPose =
  idxExt && midExt && isInfiniteVoidCross(lm) && idxMidTipDist < 0.07;

if (voidPose) {
  const s = Math.min(1, 1 - idxMidTipDist / 0.07);
  return { technique: 'infiniteVoid', strength: Math.max(0.4, s) };
}
```

### 2.3 깜빡임 방지(안정화): 후보 기술을 ‘락’ 후 적용

손 인식은 매 프레임 노이즈가 섞이기 때문에, 바로 technique을 바꾸면 연출이 튑니다.

그래서 `HandCamera`에는 후보 technique를 일정 프레임 이상 반복 확인하면(여기서는 `count >= 4`) 그 값을 “적용(locked)”하는 안정화 로직이 들어 있습니다.

```ts
const locked = s.count >= 4;
const applied = locked ? s.candidate : lastTechRef.current;
...
if (locked) {
  if (
    s.candidate !== lastTechRef.current ||
    Math.abs(s.strengthEma - lastStrengthRef.current) > 0.07
  ) {
    lastTechRef.current = s.candidate;
    lastStrengthRef.current = s.strengthEma;
    onTechniqueRef.current(s.candidate, s.strengthEma);
  }
}
```

이렇게 하면 “이벤트가 정확한 타이밍에 터지는 느낌”이 생기고, strength도 자연스럽게 변합니다.

---

## 3. 렌더링 파이프라인: technique/strength → 카메라/포스트FX/파티클

### 3.1 전체 구조(상태 → 씬 조합)

`App.tsx`에서 `technique`, `strength` 상태를 만들고 `MainCanvas`로 전달합니다. `MainCanvas` 내부에서는 `World`가 씬 오브젝트들을 조립합니다.

`MainCanvas.tsx`에서 `World`는 다음을 담당합니다.

- 카메라 연출(`CinematicCamera`)
- 톤머핑 노출(`ExposureRig`)
- 포그/라이트/배경(`Starfield`, `NebulaDust`)
- 레이어 연출(`FloatingSquares`, 기법별 이펙트, `WarpTunnel`)
- 포스트프로세싱(`PostFX`)

핵심 조립 코드는 아래처럼 한 파일에 모여 있습니다.

```tsx
<Starfield technique={technique} strength={strength} />
<NebulaDust
  technique={technique}
  strength={strength}
  getOffset={readOffset}
/>
<FloatingSquares
  visible={true}
  color={...}
  technique={technique}
/>
...
<WarpTunnel
  active={technique !== 'idle'}
  technique={technique}
  strength={strength}
  getOffset={readOffset}
/>
<PostFX technique={technique} strength={strength} />
```

### 3.2 카메라/포스트FX: ‘전장감’은 카메라가 만든다

`CinematicCamera`는 `technique !== 'idle'`일 때 줌(카메라 Z), FOV, 스웨이, 그리고 짧은 shake를 올립니다.

```ts
const active = technique !== 'idle';
const targetZ = active ? baseZ - 0.95 - strength * 0.74 : baseZ;
camera.position.z = THREE.MathUtils.lerp(
  camera.position.z,
  targetZ,
  0.032,
);
...
const shake =
  active
    ? (0.016 + strength * 0.05) * (0.6 + 0.4 * Math.sin(t * 8.2))
    : 0;
...
const f = active ? 42.5 + strength * 9 : 47.2;
camera.fov = THREE.MathUtils.lerp(camera.fov, f, 0.022);
camera.updateProjectionMatrix();
```

포스트FX도 strength에 따라 강도를 바꿉니다.

```ts
const bloom = {
  threshold: Math.max(0.02, bloomBase.threshold * (1 - strength * 0.35)),
  intensity: bloomBase.intensity * (1 + strength * (active ? 0.6 : 0.15)),
  radius: bloomBase.radius * (1 + strength * (active ? 0.25 : 0.05)),
};
```

여기서 중요한 포인트는 “effect를 단순히 켜고 끄는 것”이 아니라, strength에 따라 계속 변화시키는 것입니다.

### 3.3 이벤트 레이어: 워프 터널(`WarpTunnel`)

“많은 것들이 일어나는 느낌”을 위해 기법이 활성화될 때만 `WarpTunnel`을 보여줍니다.

```tsx
<WarpTunnel
  active={technique !== 'idle'}
  technique={technique}
  strength={strength}
  getOffset={readOffset}
/>
```

`WarpTunnel`은 원통 내부에 점들을 미리 생성한 뒤, 매 프레임 Z를 앞으로 밀며(멀리 → 가까이) 가까워질수록 중심으로 모이는(funnel) 형태를 만듭니다.

```ts
const funnel = Math.pow(1 - f, 1.45);
const r = init.radialBase[i] * funnel * 1.25;
...
init.zs[i] += dt * speed;
...
arr[i * 3] = Math.cos(ang) * r + o.x * 0.9 + driftX * 0.08;
arr[i * 3 + 1] = Math.sin(ang) * r + o.y * 0.7 + driftY * 0.08;
arr[i * 3 + 2] = init.zs[i];
```

이 “전방 유입”이 없으면 우주가 떠다니는 느낌만 남고, 이벤트성이 약해집니다.

---

## 4. 실행 화면 예시(캡처 가이드)

아래 내용은 “어떤 화면이 나와야 정상인지” 설명을 위한 가이드입니다. 실제 캡처를 넣으면 글의 설득력이 확 올라갑니다.

### idle (기본)

- 메인: 별(`Starfield`) + 성운/먼지(`NebulaDust`)가 천천히 회전
- 하단: 손 카메라 미리보기 + 랜드마크 스켈레톤
- 포스트FX는 약하게 동작(블룸/비네트 덜 강함)

### technique 활성

- 카메라: FOV와 줌/스웨이가 커지고, 짧은 shake로 임팩트가 생김
- 이벤트: `technique !== 'idle'`일 때 `WarpTunnel`가 활성화되어 전방에서 점들이 밀려옴
- 포스트FX: Bloom이 강해지고 Chromatic Aberration 오프셋이 증가

> [여기에 실행 화면 캡처 이미지 삽입]

가능하면 아래 구도를 추천합니다.

- 전체 화면(우주 이펙트)
- 하단 손 카메라가 같이 보이게
- 한 번은 `idle`, 한 번은 `red`(또는 `infiniteVoid`) 같은 “기법 차이”가 보이게

---

## 5. 디버그/품질 팁 (간단하지만 중요)

이 프로젝트는 `useFrame` 내부에서 파티클의 위치/재질 값을 매 프레임 갱신하고, 랜덤 초기화를 사용합니다.

이때 React Hooks의 “purity/immutability” 린트가 걸릴 수 있어서, 프로젝트 레벨에서 관련 룰을 꺼서(런타임에는 영향 없음) 실험 속도를 확보했습니다.

```js
'react-hooks/purity': 'off',
'react-hooks/immutability': 'off',
```

---

## 6. 마무리: 다음 확장 아이디어

다음 단계로는 아래가 자연스럽습니다.

- technique별 “쿨다운/타임라인”을 만들어 이벤트 템포를 조절
- 워프 터널에 스월(swirling) 패턴을 더 추가
- 포스트FX에 DOF(디푸전) 또는 그레인(필름 노이즈) 계열을 추가

“입력(손 제스처) → 상태(technique/strength) → 연출 파라미터”라는 구조가 이미 잡혀 있어서, 확장은 비교적 쉬운 편입니다.

