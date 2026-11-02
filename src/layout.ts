export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  /** Screen pixels per image pixel. */
  s: number;
  board: Rect;
  tray: Rect;
  w: number;
  h: number;
}

const PAD = 8;
const GAP = 10;
/** Tray area relative to board area. */
const TRAY_RATIO = 1.2;
const MAX_SCALE = 2.5;

/** Stacks board over tray or places them side by side, whichever allows the larger board. */
export function computeLayout(W: number, H: number, iw: number, ih: number): Layout {
  const aw = Math.max(1, W - 2 * PAD);
  const ah = Math.max(1, H - 2 * PAD);
  const sStacked = Math.min(aw / iw, (ah - GAP) / (ih * (1 + TRAY_RATIO)));
  const sSide = Math.min((aw - GAP) / (iw * (1 + TRAY_RATIO)), ah / ih);
  const stacked = sStacked >= sSide;
  const s = Math.min(Math.max(stacked ? sStacked : sSide, 0.05), MAX_SCALE);
  const bw = iw * s;
  const bh = ih * s;

  if (stacked) {
    return {
      s,
      w: W,
      h: H,
      board: { x: PAD + (aw - bw) / 2, y: PAD, w: bw, h: bh },
      tray: { x: PAD, y: PAD + bh + GAP, w: aw, h: Math.max(0, ah - bh - GAP) },
    };
  }
  return {
    s,
    w: W,
    h: H,
    board: { x: PAD, y: PAD + (ah - bh) / 2, w: bw, h: bh },
    tray: { x: PAD + bw + GAP, y: PAD, w: Math.max(0, aw - bw - GAP), h: ah },
  };
}
