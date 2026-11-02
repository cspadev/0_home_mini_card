import type { CardName } from './types';

/** Input boxes of the template in image pixels. */
const FIELDS = {
  last: { x: 307, y: 267, w: 860, h: 40 },
  first: { x: 307, y: 345, w: 860, h: 40 },
} as const;

const PADDING_X = 14;
const FONT_SIZE = 27;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

function loadTemplate(templateUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Card template failed to load'));
    img.src = templateUrl;
  });
}

function drawField(ctx: CanvasRenderingContext2D, field: (typeof FIELDS)[keyof typeof FIELDS], text: string) {
  if (!text) return;
  const maxWidth = field.w - 2 * PADDING_X;
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  const width = ctx.measureText(text).width;
  // Shrink long names so they stay inside the box.
  const size = width > maxWidth ? Math.floor((FONT_SIZE * maxWidth) / width) : FONT_SIZE;
  ctx.font = `${size}px ${FONT_FAMILY}`;
  ctx.fillText(text, field.x + PADDING_X, field.y + field.h / 2 + 1);
}

/** Returns a data URL of the empty card with the name written into the Příjmení and Jméno fields. */
export async function renderCard(name: CardName, templateUrl: string): Promise<string> {
  const img = await loadTemplate(templateUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  drawField(ctx, FIELDS.last, name.last);
  drawField(ctx, FIELDS.first, name.first);
  return canvas.toDataURL('image/png');
}
