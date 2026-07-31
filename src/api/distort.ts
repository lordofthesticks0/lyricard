const GRID_SIZE = 256
const FBM_OCTAVES = 2
const FBM_GAIN = 0.5
const FBM_LACUNARITY = 2
const DEFAULT_FREQ = 0.32
const DEFAULT_AMPLITUDE_PX = 120

interface DisplacementGrid {
  size: number
  dx: Float32Array
  dy: Float32Array
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function hash2(x: number, y: number, seed: number): number {
  const dot = x * 127.1 + y * 311.7 + seed * 74.7
  return fract(Math.sin(dot) * 43758.5453123)
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function valueNoise2d(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const sx = smoothstep(x - x0)
  const sy = smoothstep(y - y0)

  const n00 = hash2(x0, y0, seed)
  const n10 = hash2(x1, y0, seed)
  const n01 = hash2(x0, y1, seed)
  const n11 = hash2(x1, y1, seed)
  const nx0 = lerp(n00, n10, sx)
  const nx1 = lerp(n01, n11, sx)
  return lerp(nx0, nx1, sy) * 2 - 1
}

function fbm(x: number, y: number, seed: number): number {
  let amplitude = 1
  let frequency = 1
  let total = 0
  let norm = 0

  for (let i = 0; i < FBM_OCTAVES; i += 1) {
    total += valueNoise2d(x * frequency, y * frequency, seed + i * 19.31) * amplitude
    norm += amplitude
    amplitude *= FBM_GAIN
    frequency *= FBM_LACUNARITY
  }

  return total / norm
}

function buildDisplacementGrid(freq: number, amplitudePx: number, seedA: number, seedB: number): DisplacementGrid {
  const total = GRID_SIZE * GRID_SIZE
  const rawDx = new Float32Array(total)
  const rawDy = new Float32Array(total)
  let minDx = Infinity
  let maxDx = -Infinity
  let minDy = Infinity
  let maxDy = -Infinity

  for (let gy = 0; gy < GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      const x = gx / (GRID_SIZE - 1)
      const y = gy / (GRID_SIZE - 1)
      const idx = gy * GRID_SIZE + gx

      const dx = fbm(x * freq, y * freq, seedA)
      const dy = fbm(x * freq, y * freq, seedB)
      rawDx[idx] = dx
      rawDy[idx] = dy
      if (dx < minDx) minDx = dx
      if (dx > maxDx) maxDx = dx
      if (dy < minDy) minDy = dy
      if (dy > maxDy) maxDy = dy
    }
  }

  const dxRange = maxDx - minDx || 1
  const dyRange = maxDy - minDy || 1
  const outDx = new Float32Array(total)
  const outDy = new Float32Array(total)

  for (let i = 0; i < total; i += 1) {
    const nx = ((rawDx[i] - minDx) / dxRange) * 2 - 1
    const ny = ((rawDy[i] - minDy) / dyRange) * 2 - 1
    outDx[i] = nx * amplitudePx
    outDy[i] = ny * amplitudePx
  }

  return { size: GRID_SIZE, dx: outDx, dy: outDy }
}

function sampleGrid(grid: Float32Array, size: number, gx: number, gy: number): number {
  const x = Math.max(0, Math.min(size - 1, gx))
  const y = Math.max(0, Math.min(size - 1, gy))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(size - 1, x0 + 1)
  const y1 = Math.min(size - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const i00 = y0 * size + x0
  const i10 = y0 * size + x1
  const i01 = y1 * size + x0
  const i11 = y1 * size + x1
  const a = lerp(grid[i00], grid[i10], tx)
  const b = lerp(grid[i01], grid[i11], tx)
  return lerp(a, b, ty)
}

function sampleSourceBilinear(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  out: Uint8ClampedArray,
  outIndex: number,
): void {
  const sx = Math.max(0, Math.min(width - 1, x))
  const sy = Math.max(0, Math.min(height - 1, y))
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = sx - x0
  const ty = sy - y0

  const idx00 = (y0 * width + x0) * 4
  const idx10 = (y0 * width + x1) * 4
  const idx01 = (y1 * width + x0) * 4
  const idx11 = (y1 * width + x1) * 4

  for (let c = 0; c < 4; c += 1) {
    const a = lerp(src[idx00 + c], src[idx10 + c], tx)
    const b = lerp(src[idx01 + c], src[idx11 + c], tx)
    out[outIndex + c] = lerp(a, b, ty)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function createDistortedBackgroundDataUrl(
  sourceDataUrl: string,
  options?: { freq?: number; amplitudePx?: number; seedA?: number; seedB?: number },
): Promise<string> {
  const freq = options?.freq ?? DEFAULT_FREQ
  const amplitudePx = options?.amplitudePx ?? DEFAULT_AMPLITUDE_PX
  const seedA = options?.seedA ?? 17.93
  const seedB = options?.seedB ?? 91.27
  const image = await loadImage(sourceDataUrl)
  const width = image.naturalWidth
  const height = image.naturalHeight

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = width
  srcCanvas.height = height
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) {
    throw new Error('Unable to create source canvas context')
  }
  // Determine deterministic rotation angle (e.g. within -45 to +45 degrees)
  const angleRad = (hash2(seedA, seedB, 3.14159) * 2 - 1) * (Math.PI / 4)

  srcCtx.save()
  srcCtx.translate(width / 2, height / 2)
  srcCtx.rotate(angleRad)
  // Scale slightly to prevent empty/blank corners after rotation
  const scale = Math.abs(Math.sin(angleRad)) + Math.abs(Math.cos(angleRad))
  srcCtx.scale(scale, scale)
  srcCtx.drawImage(image, -width / 2, -height / 2, width, height)
  srcCtx.restore()

  const srcImageData = srcCtx.getImageData(0, 0, width, height)
  const srcPixels = srcImageData.data

  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) {
    throw new Error('Unable to create output canvas context')
  }

  const output = outCtx.createImageData(width, height)
  const grid = buildDisplacementGrid(freq, amplitudePx, seedA, seedB)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = width > 1 ? x / (width - 1) : 0
      const v = height > 1 ? y / (height - 1) : 0
      const gx = u * (grid.size - 1)
      const gy = v * (grid.size - 1)
      const dx = sampleGrid(grid.dx, grid.size, gx, gy)
      const dy = sampleGrid(grid.dy, grid.size, gx, gy)
      const outIndex = (y * width + x) * 4
      sampleSourceBilinear(srcPixels, width, height, x + dx, y + dy, output.data, outIndex)
    }
  }

  outCtx.putImageData(output, 0, 0)
  return outCanvas.toDataURL('image/jpeg', 0.95)
}
