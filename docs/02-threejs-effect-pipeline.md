# react-three/fiber로 만드는 실시간 우주 이펙트 파이프라인

이 글은 “우주 같고 웅장하게”라는 결과를 얻기 위해, Three.js 씬을 어떻게 레이어로 분해하고(`Starfield` / `NebulaDust` / `WarpTunnel` / 포스트FX), `technique` / `strength`로 동적으로 튜닝하는지에 초점을 맞춥니다.

이 프로젝트는 단일 거대한 쉐이더/모놀리식 코드 대신, 작은 연출 컴포넌트들을 조립하는 방식으로 확장성을 확보했습니다.

---

## 실행 방법(캡처용)

```bash
npm install
npm run dev
```

브라우저에서 카메라 권한을 허용하면, 메인 캔버스에 우주 이펙트가 표시되고 손 제스처에 따라 연출이 바뀝니다.

## 1. 큰 그림: 레이어(오브젝트) + 연출(카메라) + 후처리(포스트FX)

구성은 대략 아래 흐름입니다.

1. `World`가 오브젝트 레이어를 조립
2. `CinematicCamera`와 `ExposureRig`가 카메라/톤머핑을 연출
3. `PostFX`가 Bloom/Chromatic Aberration/Vignette를 strength에 따라 조절

`MainCanvas`에서 핵심 조립은 아래처럼 한 번에 확인됩니다.

```tsx
<Starfield technique={technique} strength={strength} />
<NebulaDust
  technique={technique}
  strength={strength}
  getOffset={readOffset}
/>
<FloatingSquares visible={true} color={...} technique={technique} />
...
<WarpTunnel
  active={technique !== 'idle'}
  technique={technique}
  strength={strength}
  getOffset={readOffset}
/>
<PostFX technique={technique} strength={strength} />
```

이렇게 레이어를 분해하면, “무엇이 웅장함을 만들었는지”도 추적하기 쉬워집니다.

---

## 2. 배경 파트: `Starfield`를 2레이어로 만든 이유

단일 별필드는 “깊이감”을 만들기 어렵습니다. 그래서 이 프로젝트는 근거리 레이어와 원거리 레이어를 분리했습니다.

- `near`: 상대적으로 크고(더 밝고 크게 보이게), 속도가 빠름
- `far`: 상대적으로 작고(더 희미하게), 속도가 느림

`Starfield`에서 근/원 파티클 수와 위치 분포를 다르게 생성합니다.

```ts
const NEAR_COUNT = 9000;
const FAR_COUNT = 12000;

const nearPositions = useMemo(() => {
  const arr = new Float32Array(NEAR_COUNT * 3);
  for (let i = 0; i < NEAR_COUNT; i++) {
    const r = 10 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}, []);

const farPositions = useMemo(() => {
  const arr = new Float32Array(FAR_COUNT * 3);
  for (let i = 0; i < FAR_COUNT; i++) {
    const r = 26 + Math.random() * 52;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}, []);
```

매 프레임에는 회전 속도를 technique/strength에 따라 바꾸고, 드리프트도 약하게 섞어 “살아있는” 느낌을 만들어요.

```ts
const tBoost = 1 + strength * 1.15;
const nearSpeed = nearSpeedBase(technique) * tBoost;
const farSpeed = farSpeedBase(technique) * (1 + strength * 0.75);
...
nearPts.rotation.y += dt * 0.011 * nearSpeed;
farPts.rotation.y += dt * 0.007 * farSpeed;
```

---

## 3. 항상 켜져 있는 볼륨: `NebulaDust`

웅장함은 이벤트만으로는 부족합니다. “항상 깔려 있는 성운/먼지 볼륨”이 있어야 배경이 깊고 풍성해 보여요.

`NebulaDust`는 점(`Points`)으로 성운을 흉내 냈습니다. 분포는 구형 볼륨 기반이되, y축을 눌러 디스크처럼 보이게 했습니다.

```ts
const NEBULA_N = 9000;
...
const y = radius * Math.cos(phi) * 0.58; // 디스크처럼 납작하게
const pull = 1 - Math.pow(radius / 60, 0.9) * 0.22;
...
arr[i * 3 + 1] = y * pull;
```

이후 `useFrame`에서 technique 활성 여부와 strength에 따라 opacity/size를 조정해 “기법이 켜질 때 더 또렷해지는” 느낌을 줍니다.

```ts
const active = technique !== 'idle';
mat.opacity = (active ? 0.36 : 0.20) + strength * (active ? 0.38 : 0.12);
mat.opacity += Math.sin(t * 1.2) * 0.035;
mat.size = (active ? 0.055 : 0.045) * (1 + strength * 0.55);
```

---

## 4. 이벤트 파트: `WarpTunnel`로 “일어나는” 느낌 만들기

사용자 체감에서 가장 강하게 작동하는 건 “전방에서 들어오는 움직임”입니다.

`WarpTunnel`은 원통 내부의 점들을 미리 만들고, 매 프레임 Z를 앞으로 밀어 가까워지게 한 뒤 중심으로 모이도록 funnel 형태를 만듭니다.

```ts
const TUNNEL_N = 9000;
const Z_MIN = -58;
const Z_MAX = 6;
...
const funnel = Math.pow(1 - f, 1.45);
const r = init.radialBase[i] * funnel * 1.25;
...
init.zs[i] += dt * speed;
if (init.zs[i] > Z_MAX) {
  init.zs[i] = Z_MIN + Math.random() * (Z_MAX - Z_MIN) * 0.12;
}
```

또한 hand 오프셋(`getOffset()`)이 들어가서 터널 중심이 살짝 따라오는 느낌을 줍니다.

```ts
arr[i * 3] = Math.cos(ang) * r + o.x * 0.9 + driftX * 0.08;
arr[i * 3 + 1] = Math.sin(ang) * r + o.y * 0.7 + driftY * 0.08;
```

`MainCanvas`에서는 아래 조건으로 활성화합니다.

```tsx
active={technique !== 'idle'}
```

이 덕분에 “idle에서는 배경이 풍부, technique에서는 사건이 터지는” 구조가 됩니다.

---

## 5. 카메라/노출/포스트FX: strength 기반 “연출 게인”

이 프로젝트에서 `strength`는 단순 세기가 아니라 “파라미터 게인” 역할을 합니다.

### 5.1 카메라 (줌/스웨이/shake/FOV)

```ts
const targetZ = active ? baseZ - 0.95 - strength * 0.74 : baseZ;
...
const shake =
  active ? (0.016 + strength * 0.05) * (0.6 + 0.4 * Math.sin(t * 8.2)) : 0;
...
const f = active ? 42.5 + strength * 9 : 47.2;
camera.fov = THREE.MathUtils.lerp(camera.fov, f, 0.022);
```

### 5.2 Tone Mapping Exposure

```ts
const target = technique === 'idle' ? 1.02 : 1.22 + strength * 0.18;
gl.toneMappingExposure += (target - gl.toneMappingExposure) * 0.06;
```

### 5.3 PostFX (Bloom / ChromaticAberration / Vignette)

Bloom은 `strength`에 따라 threshold/intensity/radius를 함께 조절합니다.

```ts
const bloom = {
  threshold: Math.max(0.02, bloomBase.threshold * (1 - strength * 0.35)),
  intensity: bloomBase.intensity * (1 + strength * (active ? 0.6 : 0.15)),
  radius: bloomBase.radius * (1 + strength * (active ? 0.25 : 0.05)),
};
```

Chromatic Aberration 오프셋도 strength 반영:

```ts
const k = active ? 1 + strength * 2.2 : 1;
return new THREE.Vector2(a * k, a * k);
```

---

## 6. 품질/성능 팁(현장에서 실제로 중요했던 부분)

이 프로젝트는 파티클을 많이 쓰기 때문에, “항상 최대로” 돌리면 금방 무거워집니다.

- background(별/먼지)는 항상 가되, 이벤트(WarpTunnel)는 `technique !== 'idle'`에서만 활성
- layer 분리로 “무슨 레이어가 무거운지” 추적 가능
- 카메라/포스트FX는 strength에 따라 단계적으로 올려서 과도한 리렌더/재생성 없이 연출 효과를 최대화

---

## 7. 실행 화면 예시(캡처 가이드)

아래는 독자가 글을 보고 “이게 맞는 결과”인지 확인할 수 있도록 정리한 화면 가이드입니다.

### idle

- 메인: `Starfield` 근/원 별 레이어 + `NebulaDust` 성운 점들이 천천히 회전
- 하단: 손 카메라 미리보기 + 랜드마크 스켈레톤
- 포스트FX: Bloom과 Vignette가 약하게 보임

### red / hollowPurple / infiniteVoid / malevolentShrine

- 메인: `WarpTunnel`이 켜지며 전방 유입 느낌이 생김
- 카메라: FOV/줌/스웨이 + 짧은 shake로 임팩트 강화
- 포스트FX: Bloom 강도/반경이 증가하고, Chromatic Aberration 오프셋이 커짐

> [여기에 실행 화면 캡처 이미지 삽입]

---

## 8. (선택) 린트/개발 이슈: 랜덤/뮤터블 업데이트

이 프로젝트는 파티클 초기 생성에 `Math.random()`을 쓰고, `useFrame`에서 geometry/material을 직접 업데이트합니다.

이때 프로젝트의 React Hooks purity/immutability 규칙과 충돌해서, 개발 속도를 위해 ESLint 설정에서 해당 룰을 비활성화했습니다.

```js
'react-hooks/purity': 'off',
'react-hooks/immutability': 'off',
```

런타임 동작에는 영향이 없고(실제로 동작은 잘 함), 실험/튜닝에 더 집중할 수 있는 선택이었습니다.

