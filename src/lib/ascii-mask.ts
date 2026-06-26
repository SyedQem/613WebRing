/**
 * ASCII mask sampling — turns the BCO logo (and a procedural ring) into a
 * low-resolution intensity grid that the canvas renderers paint as `0`/`1`.
 *
 * Client-only: uses Image / canvas. Results are cached per requested grid size
 * so repeated calls (resize, multiple components) never re-decode the image.
 */
export type Mask = {
  cols: number;
  rows: number;
  /** Row-major intensity, 0 (empty) → 1 (solid logo). */
  data: Float32Array;
};

let imagePromise: Promise<HTMLImageElement> | null = null;
const maskCache = new Map<string, Mask>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (!imagePromise) {
    imagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  return imagePromise;
}

/**
 * Sample the logo into a `cols × rows` intensity grid. The logo is fit with a
 * "contain" scale and centred, so transparent margins read as empty cells.
 */
export async function getLogoMask(
  cols: number,
  rows: number,
  src = "/bco-logo.png",
): Promise<Mask> {
  const key = `${src}@${cols}x${rows}`;
  const cached = maskCache.get(key);
  if (cached) return cached;

  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { cols, rows, data: new Float32Array(cols * rows) };

  const scale = Math.min(cols / img.width, rows / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h);

  const px = ctx.getImageData(0, 0, cols, rows).data;
  const data = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const a = px[i * 4 + 3] / 255;
    const lum =
      (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    // Weight the silhouette by brightness so the chrome reads as denser glyphs.
    data[i] = a * (0.4 + 0.6 * lum);
  }

  const mask = { cols, rows, data };
  maskCache.set(key, mask);
  return mask;
}

/** A procedural circular ring mask (used by the manifesto scene). */
export function ringMask(size: number, thickness = 0.16): Mask {
  const data = new Float32Array(size * size);
  const c = (size - 1) / 2;
  const outer = size * 0.46;
  const inner = outer * (1 - thickness);
  const mid = (outer + inner) / 2;
  const half = (outer - inner) / 2 || 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const v = d <= outer && d >= inner ? 1 - Math.abs((d - mid) / half) : 0;
      data[y * size + x] = Math.max(0, v);
    }
  }
  return { cols: size, rows: size, data };
}
