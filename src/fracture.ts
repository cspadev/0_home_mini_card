import { Delaunay } from 'd3-delaunay';
import type { LoadedImage, PieceShape } from './types';

type Pt = [number, number];

export function loadImage(url: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ url: img.src, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = url;
  });
}

/** Picks the smallest-overshoot cols x rows grid with at least `count` cells whose cells are closest to square. */
function gridFor(count: number, w: number, h: number) {
  let best = { cols: 1, rows: count, cost: Infinity };
  for (let cols = 1; cols <= count; cols++) {
    for (let rows = Math.ceil(count / cols); rows <= count; rows++) {
      const cost =
        Math.abs(cols * rows - count) / count + Math.abs(Math.log(w / cols / (h / rows)));
      if (cost < best.cost) best = { cols, rows, cost };
    }
  }
  return best;
}

function centroid(poly: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function cells(seeds: Pt[], w: number, h: number): Pt[][] {
  const vor = Delaunay.from(seeds).voronoi([0, 0, w, h]);
  return seeds.map((_, i) => {
    const ring = vor.cellPolygon(i) as Pt[] | null;
    return ring ? ring.slice(0, -1) : [];
  });
}

/** Splits a w x h image into exactly `count` irregular Voronoi pieces. */
export function fracture(w: number, h: number, count: number): PieceShape[] {
  const { cols, rows } = gridFor(count, w, h);
  const cw = w / cols;
  const ch = h / rows;

  let seeds: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seeds.push([
        (c + 0.5 + (Math.random() - 0.5) * 0.7) * cw,
        (r + 0.5 + (Math.random() - 0.5) * 0.7) * ch,
      ]);
    }
  }

  // The grid may have more cells than requested; drop random seeds so the piece count is exact.
  while (seeds.length > count) seeds.splice(Math.floor(Math.random() * seeds.length), 1);

  // Half-steps of Lloyd relaxation avoid slivers while keeping the shapes irregular;
  // more steps when seeds were dropped to even out the larger cells.
  const steps = seeds.length < rows * cols ? 3 : 1;
  for (let step = 0; step < steps; step++) {
    const relaxed = cells(seeds, w, h);
    seeds = seeds.map((s, i) => {
      if (relaxed[i].length < 3) return s;
      const c = centroid(relaxed[i]);
      return [s[0] + (c[0] - s[0]) * 0.5, s[1] + (c[1] - s[1]) * 0.5];
    });
  }

  const f = (n: number) => Math.round(n * 1000) / 1000;
  const shapes: PieceShape[] = [];
  cells(seeds, w, h).forEach((poly) => {
    if (poly.length < 3) return;
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const bw = Math.max(...xs) - x;
    const bh = Math.max(...ys) - y;
    const [gx, gy] = centroid(poly);
    shapes.push({
      id: shapes.length,
      x,
      y,
      w: bw,
      h: bh,
      clip: `polygon(${poly
        .map((p) => `${f(((p[0] - x) / bw) * 100)}% ${f(((p[1] - y) / bh) * 100)}%`)
        .join(', ')})`,
      ox: gx - x,
      oy: gy - y,
    });
  });
  return shapes;
}
