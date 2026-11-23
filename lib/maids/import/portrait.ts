/**
 * Finds a portrait-shaped block of pixels on a rendered page (the FDW photo on
 * a scanned biodata form). Pure and DOM-free so it can run in the browser and
 * be unit tested. Returns coordinates in the supplied image's pixel space.
 */
export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

export type PortraitRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

const MIN_AREA_RATIO = 0.02;
const MAX_AREA_RATIO = 0.55;
const MIN_ASPECT = 0.5;
const MAX_ASPECT = 1.6;
const MIN_COLOUR_RATIO = 0.12;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
};

/** Largest all-foreground rectangles (histogram stack, top candidates). */
function foregroundRects(mask: Uint8Array, width: number, height: number) {
  const heights = new Int32Array(width);
  const candidates: Rect[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1)
      heights[x] = mask[y * width + x] ? heights[x] + 1 : 0;
    const stack: number[] = [];
    for (let x = 0; x <= width; x += 1) {
      const current = x === width ? 0 : heights[x];
      while (stack.length > 0 && heights[stack[stack.length - 1]] >= current) {
        const barHeight = heights[stack.pop() as number];
        const left = stack.length > 0 ? stack[stack.length - 1] + 1 : 0;
        const barWidth = x - left;
        if (barHeight > 0 && barWidth > 0)
          candidates.push({
            x: left,
            y: y - barHeight + 1,
            width: barWidth,
            height: barHeight,
            area: barWidth * barHeight,
          });
      }
      stack.push(x);
    }
  }
  return candidates.sort((a, b) => b.area - a.area).slice(0, 12);
}

function findForegroundSeed(
  mask: Uint8Array,
  width: number,
  rect: Rect,
): [number, number] {
  for (let y = rect.y; y < rect.y + rect.height; y += 1)
    for (let x = rect.x; x < rect.x + rect.width; x += 1)
      if (mask[y * width + x] === 1) return [x, y];
  return [rect.x, rect.y];
}

/** Bounding box and pixel count of the foreground blob containing a seed. */
function componentBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
) {
  const start = seedY * width + seedX;
  if (mask[start] !== 1) return null;
  const seen = new Uint8Array(width * height);
  const stack = [start];
  seen[start] = 1;
  let minX = seedX;
  let maxX = seedX;
  let minY = seedY;
  let maxY = seedY;
  let area = 0;
  while (stack.length > 0) {
    const index = stack.pop() as number;
    const x = index % width;
    const y = (index - x) / width;
    area += 1;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const offset = ny * width + nx;
      if (mask[offset] !== 1 || seen[offset]) continue;
      seen[offset] = 1;
      stack.push(offset);
    }
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area,
  };
}

/**
 * Scores a rectangle as the FDW portrait. Rejects thin text lines, banners and
 * huge page-wide blocks. Returns `null` when nothing is confident.
 */
export function findPortraitRegion(image: RgbaImage): PortraitRegion | null {
  const { width, height, data } = image;
  if (width < 40 || height < 40) return null;
  const pixels = width * height;
  if (data.length < pixels * 4) return null;

  // Text and photos are foreground; the paper background is near-white.
  const mask = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha < 16) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= 238) continue;
    mask[pixel] = max - min >= 12 || max < 205 ? 1 : 0;
  }

  let best: PortraitRegion | null = null;
  for (const rect of foregroundRects(mask, width, height)) {
    // A photo often has white clothing, which punches holes in the largest
    // rectangle. Grow the candidate to its connected photo region instead.
    const seedX = rect.x + Math.floor(rect.width / 2);
    const seedY = rect.y + Math.floor(rect.height / 2);
    const box =
      componentBounds(mask, width, height, seedX, seedY) ??
      componentBounds(
        mask,
        width,
        height,
        ...findForegroundSeed(mask, width, rect),
      ) ??
      rect;
    const bboxArea = box.width * box.height;
    const areaRatio = bboxArea / pixels;
    if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) continue;
    const aspect = box.width / box.height;
    if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) continue;
    if (box.width < width * 0.06 || box.height < height * 0.08) continue;
    // A table border can connect into a huge sparse box; photos are dense.
    if (box.area / bboxArea < 0.3) continue;

    let colourful = 0;
    let white = 0;
    let sampled = 0;
    const step = Math.max(1, Math.floor(bboxArea / 3000));
    for (let y = box.y; y < box.y + box.height; y += 1) {
      for (let x = box.x; x < box.x + box.width; x += step) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        sampled += 1;
        if (max - min >= 30) colourful += 1;
        if (min >= 232) white += 1;
      }
    }
    if (sampled === 0) continue;
    const colourRatio = colourful / sampled;
    const whiteRatio = white / sampled;
    if (colourRatio < MIN_COLOUR_RATIO) continue;
    if (whiteRatio > 0.75) continue;

    const score = areaRatio * (0.5 + colourRatio) * (1 - whiteRatio * 0.5);
    if (!best || score > best.score)
      best = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        score,
      };
  }
  return best;
}
