import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { Technique } from './technique';

const W = 0;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;
const THUMB_TIP = 4;

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 펴짐: 손목–끝 > 손목–PIP (영상 데모와 맞게 약간 여유) */
function isExtended(
  lm: NormalizedLandmark[],
  pip: number,
  tip: number,
  factor = 1.03,
): boolean {
  return dist(lm[W], lm[tip]) > dist(lm[W], lm[pip]) * factor;
}

/** 접힘: 손목–끝이 손목–PIP보다 분명히 짧음 (「적」용) */
function isClearlyCurled(
  lm: NormalizedLandmark[],
  pip: number,
  tip: number,
): boolean {
  return dist(lm[W], lm[tip]) < dist(lm[W], lm[pip]) * 0.99;
}

/**
 * 無量空処: 검지·중지가 X로 교차하고 끝마디가 매우 가까움.
 * 미러(전면 카메라)에서도 동작하도록 2D 외적으로 “교차” 여부만 본다.
 */
function isInfiniteVoidCross(lm: NormalizedLandmark[]): boolean {
  const iTip = lm[INDEX_TIP];
  const mTip = lm[MIDDLE_TIP];
  const mMcp = lm[MIDDLE_MCP];

  const dTips = dist(iTip, mTip);
  if (dTips > 0.07) return false;

  const mdx = mTip.x - mMcp.x;
  const mdy = mTip.y - mMcp.y;
  const vx = iTip.x - mMcp.x;
  const vy = iTip.y - mMcp.y;
  const crossZ = Math.abs(mdx * vy - mdy * vx);

  // 교차 시 검지 끝이 중지 축에서 옆으로 벗어남 → 외적 크기
  return crossZ > 0.00025;
}

export type GestureResult = {
  technique: Technique;
  strength: number;
};

/**
 * 영상과 같은 매핑·우선순위:
 * 1) 교차+끝 근접 → 無量空処
 * 2) 엄지·검지 OK(핀치) — 단 1)가 아닐 때만 → 허공주자
 * 3) 검지만 펴고 나머지 접음 + 핀치 아님 → 적
 * 4) 네 손가락 펴고 1)·2) 아님 → 伏魔御厨子
 */
export function resolveGesture(lm: NormalizedLandmark[]): GestureResult {
  const idxExt = isExtended(lm, INDEX_PIP, INDEX_TIP);
  const midExt = isExtended(lm, MIDDLE_PIP, MIDDLE_TIP);
  const ringExt = isExtended(lm, RING_PIP, RING_TIP);
  const pinkyExt = isExtended(lm, PINKY_PIP, PINKY_TIP);

  const pinchDist = dist(lm[THUMB_TIP], lm[INDEX_TIP]);
  const idxMidTipDist = dist(lm[INDEX_TIP], lm[MIDDLE_TIP]);

  const voidPose =
    idxExt && midExt && isInfiniteVoidCross(lm) && idxMidTipDist < 0.07;

  if (voidPose) {
    const s = Math.min(1, 1 - idxMidTipDist / 0.07);
    return { technique: 'infiniteVoid', strength: Math.max(0.4, s) };
  }

  // 허공주자: OK 링 — 무한공허 자세와 겹치지 않게 핀치만 인정
  const purplePinch = pinchDist < 0.052;
  if (purplePinch && idxMidTipDist > 0.055) {
    const s = Math.min(1, 1 - pinchDist / 0.052);
    return { technique: 'hollowPurple', strength: Math.max(0.38, s) };
  }

  const midCurled = isClearlyCurled(lm, MIDDLE_PIP, MIDDLE_TIP);
  const ringCurled = isClearlyCurled(lm, RING_PIP, RING_TIP);
  const pinkyCurled = isClearlyCurled(lm, PINKY_PIP, PINKY_TIP);

  const redPoint =
    idxExt &&
    midCurled &&
    ringCurled &&
    pinkyCurled &&
    pinchDist > 0.105;

  if (redPoint) {
    return { technique: 'red', strength: 0.9 };
  }

  const shrineOpen =
    idxExt &&
    midExt &&
    ringExt &&
    pinkyExt &&
    idxMidTipDist > 0.085 &&
    pinchDist > 0.075;

  if (shrineOpen) {
    return { technique: 'malevolentShrine', strength: 0.92 };
  }

  return { technique: 'idle', strength: 0 };
}

export function handCenterOffset(lm: NormalizedLandmark[]): {
  x: number;
  y: number;
} {
  return {
    x: (lm[W].x - 0.5) * 1.2,
    y: -(lm[W].y - 0.5) * 0.9,
  };
}
