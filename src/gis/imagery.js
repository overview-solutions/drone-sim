import {tileUrl,latitude,mercatorY} from './core.js';
export {latitude,mercatorY};
const cache=new Map();

function tile(z, x, y, invalidate, mode) {
  const key = [mode, z, y, x].join('/');
  if (!cache.has(key)) {
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    const image = new Image();
    const record = { image, callbacks: new Set(), ready: false };
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      record.ready = true;
      for (const callback of record.callbacks) callback();
      record.callbacks.clear();
    };
    image.onerror = () => {
      record.failed = true;
      for (const callback of record.callbacks) callback();
      record.callbacks.clear();
    };
    cache.set(key, record);
    image.src = tileUrl(mode,z,x,y);
  }
  const record = cache.get(key);
  if (!record.ready && !record.failed) record.callbacks.add(invalidate);
  return record;
}

export function availableTile(z, col, row, invalidate, mode = 'imagery') {
  for (let level = z; level >= 0; level--) {
    const divisor = 2 ** (z - level);
    const size = 2 ** level;
    const parent = Math.floor(col / divisor);
    const record = tile(level, ((parent % size) + size) % size, Math.floor(row / divisor), invalidate, mode);
    if (record.ready) {
      const pixels = record.image.naturalWidth / divisor;
      return { image: record.image, pixels,
        x: (col - parent * divisor) * pixels, y: (row % divisor) * pixels };
    }
    if (!record.failed) {
      if (level <= 16) return null;
      level = 17;
    }
  }
  return null;
}

export function drawImagery(ctx, bounds, width, height, invalidate) {
  const { west, east, north, south } = bounds;
  const z = Math.max(0, Math.min(19, Math.round(Math.log2(width * 360 / (256 * (east - west))))));
  const size = 2 ** z;
  const xMin = Math.floor((west + 180) / 360 * size);
  const xMax = Math.ceil((east + 180) / 360 * size);
  const yMin = Math.floor(mercatorY(north) * size);
  const yMax = Math.ceil(mercatorY(south) * size);
  let loaded = false;
  for (let row = yMin; row < yMax; row++) {
    const top = (north - latitude(row / size)) / (north - south) * height;
    const bottom = (north - latitude((row + 1) / size)) / (north - south) * height;
    for (let col = xMin; col < xMax; col++) {
      const tileImage = availableTile(z, col, row, invalidate);
      if (!tileImage) continue;
      const left = ((col / size * 360 - 180) - west) / (east - west) * width;
      const { image, x, y, pixels } = tileImage;
      ctx.drawImage(image, x, y, pixels, pixels, left, top, 360 / size / (east - west) * width + .5, bottom - top + .5);
      loaded = true;
    }
  }
  return loaded;
}
