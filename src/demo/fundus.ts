import type { AttentionBlob, Findings, Lesion, LesionType } from '../types'

/* ---------------------------------------------------------------------------
   Synthetic fundus photographs.

   These are PROTOTYPE VISUALISATIONS, not clinical images. They exist so the
   demo has deterministic pictures whose lesion positions are known — which is
   what lets the lesion overlay and the attention map line up with something
   actually visible in the frame instead of floating over a stock photo.

   Everything is drawn into a 1000x1000 viewBox, so overlay coordinates are
   resolution independent and scale with the display frame.
--------------------------------------------------------------------------- */

export type QualityFlavour = 'clean' | 'dark' | 'blurred' | 'occluded'

export interface FundusSpec {
  seed: number
  side: 'left' | 'right'
  counts: Findings
  flavour: QualityFlavour
}

export interface FundusBuild {
  src: string
  lesions: Lesion[]
  attention: AttentionBlob[]
}

const CENTER = 500
const RETINA_R = 470

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n = (v: number) => Math.round(v * 10) / 10

/** Random point inside the retinal circle, biased away from the optic disc. */
function retinalPoint(rand: () => number, discX: number, ring: [number, number]) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = rand() * Math.PI * 2
    const dist = ring[0] + rand() * (ring[1] - ring[0])
    const x = CENTER + Math.cos(angle) * dist
    const y = CENTER + Math.sin(angle) * dist
    if (Math.hypot(x - discX, y - CENTER) > 105) return { x, y }
  }
  return { x: CENTER, y: CENTER }
}

const LESION_RADIUS: Record<LesionType, [number, number]> = {
  microaneurysm: [4, 7],
  haemorrhage: [11, 20],
  hard_exudate: [8, 16],
  neovascularisation: [26, 40],
}

function buildLesions(rand: () => number, counts: Findings, discX: number): Lesion[] {
  const out: Lesion[] = []
  const push = (type: LesionType, count: number, ring: [number, number]) => {
    for (let i = 0; i < count; i++) {
      const p = retinalPoint(rand, discX, ring)
      const [lo, hi] = LESION_RADIUS[type]
      out.push({
        id: `${type}-${i}`,
        type,
        x: n(p.x),
        y: n(p.y),
        r: n(lo + rand() * (hi - lo)),
      })
    }
  }
  // Microaneurysms cluster near the posterior pole; NV sits close to the disc.
  push('microaneurysm', counts.microaneurysm, [60, 320])
  push('haemorrhage', counts.haemorrhage, [90, 360])
  push('hard_exudate', counts.hard_exudate, [70, 300])
  push('neovascularisation', counts.neovascularisation, [110, 240])
  return out
}

/** Grad-CAM style attention: hot where lesions cluster, warm at the macula. */
export function buildAttention(lesions: Lesion[], rand: () => number): AttentionBlob[] {
  if (lesions.length === 0) {
    return [{ x: CENTER, y: CENTER, r: 190, weight: 0.35 }]
  }
  const blobs: AttentionBlob[] = []
  const remaining = [...lesions]
  while (remaining.length && blobs.length < 6) {
    const anchor = remaining.shift()!
    const cluster = [anchor]
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (Math.hypot(remaining[i].x - anchor.x, remaining[i].y - anchor.y) < 190) {
        cluster.push(remaining.splice(i, 1)[0])
      }
    }
    const cx = cluster.reduce((s, l) => s + l.x, 0) / cluster.length
    const cy = cluster.reduce((s, l) => s + l.y, 0) / cluster.length
    const severity = cluster.reduce(
      (s, l) => s + (l.type === 'neovascularisation' ? 3 : l.type === 'haemorrhage' ? 2 : 1),
      0,
    )
    blobs.push({
      x: n(cx),
      y: n(cy),
      r: n(120 + Math.min(cluster.length, 8) * 16),
      weight: Math.min(0.95, 0.34 + severity * 0.09),
    })
  }
  // A cooler region over the macula: the model always looks there.
  blobs.push({ x: CENTER + (rand() - 0.5) * 40, y: CENTER, r: 165, weight: 0.3 })
  return blobs.sort((a, b) => a.weight - b.weight)
}

function vesselPaths(rand: () => number, discX: number, sweep: number): string {
  const segments: string[] = []
  const walk = (
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number,
  ) => {
    const curve = (rand() - 0.5) * 0.9
    const mx = x + Math.cos(angle + curve * 0.5) * length * 0.55
    const my = y + Math.sin(angle + curve * 0.5) * length * 0.55
    const ex = x + Math.cos(angle + curve) * length
    const ey = y + Math.sin(angle + curve) * length
    segments.push(
      `<path d="M${n(x)} ${n(y)} Q${n(mx)} ${n(my)} ${n(ex)} ${n(ey)}" stroke-width="${n(width)}"/>`,
    )
    if (depth <= 0 || width < 1.6) return
    const spread = 0.34 + rand() * 0.3
    walk(ex, ey, angle + curve + spread, length * (0.62 + rand() * 0.16), width * 0.68, depth - 1)
    walk(ex, ey, angle + curve - spread, length * (0.58 + rand() * 0.18), width * 0.62, depth - 1)
  }

  // Superior and inferior arcades leave the disc and curve around the macula,
  // so the spread has to straddle the axis pointing at it — not sit on one side.
  const toward = sweep > 0 ? 0 : Math.PI
  for (const offset of [-1.2, -0.62, -0.22, 0.22, 0.62, 1.2]) {
    walk(discX, CENTER, toward + offset, 195, 10.5, 4)
  }
  return segments.join('')
}

function lesionMarkup(lesions: Lesion[], rand: () => number): string {
  return lesions
    .map((l) => {
      switch (l.type) {
        case 'microaneurysm':
          return `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="#8f1d0e" opacity="0.92"/>`
        case 'haemorrhage': {
          // Irregular blot: a few overlapping discs read as a flame haemorrhage.
          const lobes = Array.from({ length: 4 }, () => {
            const a = rand() * Math.PI * 2
            const d = rand() * l.r * 0.7
            return `<circle cx="${n(l.x + Math.cos(a) * d)}" cy="${n(l.y + Math.sin(a) * d)}" r="${n(l.r * (0.55 + rand() * 0.4))}"/>`
          }).join('')
          return `<g fill="#69130a" opacity="0.9">${lobes}</g>`
        }
        case 'hard_exudate': {
          const flecks = Array.from({ length: 5 }, () => {
            const a = rand() * Math.PI * 2
            const d = rand() * l.r
            return `<circle cx="${n(l.x + Math.cos(a) * d)}" cy="${n(l.y + Math.sin(a) * d)}" r="${n(2.5 + rand() * 4)}"/>`
          }).join('')
          return `<g fill="#f7e6a4" opacity="0.95">${flecks}</g>`
        }
        case 'neovascularisation': {
          const frond = Array.from({ length: 7 }, () => {
            const a = rand() * Math.PI * 2
            const len = l.r * (0.5 + rand() * 0.7)
            const cx = l.x + Math.cos(a + 0.6) * len * 0.6
            const cy = l.y + Math.sin(a + 0.6) * len * 0.6
            return `<path d="M${l.x} ${l.y} Q${n(cx)} ${n(cy)} ${n(l.x + Math.cos(a) * len)} ${n(l.y + Math.sin(a) * len)}"/>`
          }).join('')
          return `<g fill="none" stroke="#8a1c0c" stroke-width="2.2" opacity="0.92">${frond}</g>`
        }
      }
    })
    .join('')
}

/** Deterministic: the same spec always renders the same photograph. */
export function buildFundus(spec: FundusSpec): FundusBuild {
  const rand = mulberry32(spec.seed)
  const discX = spec.side === 'right' ? 700 : 300
  const sweep = spec.side === 'right' ? -1 : 1
  const lesions = spec.flavour === 'occluded' ? [] : buildLesions(rand, spec.counts, discX)

  const blur =
    spec.flavour === 'blurred' ? 5.5 : spec.flavour === 'occluded' ? 9 : spec.flavour === 'dark' ? 1.4 : 0.7

  const veil =
    spec.flavour === 'dark'
      ? `<circle cx="${CENTER}" cy="${CENTER}" r="${RETINA_R}" fill="#000" opacity="0.55"/>`
      : spec.flavour === 'occluded'
        ? `<circle cx="${CENTER}" cy="${CENTER}" r="${RETINA_R}" fill="#d8cbb4" opacity="0.5"/>
           <circle cx="380" cy="420" r="300" fill="#efe7d6" opacity="0.42"/>`
        : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <radialGradient id="retina" cx="50%" cy="50%" r="52%">
      <stop offset="0%" stop-color="#d2793a"/>
      <stop offset="55%" stop-color="#b95c25"/>
      <stop offset="100%" stop-color="#7c3410"/>
    </radialGradient>
    <radialGradient id="disc" cx="42%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#fdf3d6"/>
      <stop offset="70%" stop-color="#f2d79a"/>
      <stop offset="100%" stop-color="#d9ab63"/>
    </radialGradient>
    <radialGradient id="macula" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6d2c0c" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#6d2c0c" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${spec.seed % 97}"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="${blur}"/></filter>
    <clipPath id="globe"><circle cx="${CENTER}" cy="${CENTER}" r="${RETINA_R}"/></clipPath>
  </defs>
  <rect width="1000" height="1000" fill="#080603"/>
  <g clip-path="url(#globe)">
    <g filter="url(#soft)">
      <circle cx="${CENTER}" cy="${CENTER}" r="${RETINA_R}" fill="url(#retina)"/>
      <g stroke="#7d1f0d" fill="none" stroke-linecap="round" opacity="0.88">${vesselPaths(rand, discX, sweep)}</g>
      <circle cx="${CENTER}" cy="${CENTER}" r="150" fill="url(#macula)"/>
      <ellipse cx="${discX}" cy="${CENTER}" rx="66" ry="72" fill="url(#disc)"/>
      <ellipse cx="${discX}" cy="${CENTER}" rx="30" ry="34" fill="#fbf6e4" opacity="0.75"/>
      ${lesionMarkup(lesions, rand)}
    </g>
    <rect width="1000" height="1000" filter="url(#grain)" opacity="0.11"/>
    ${veil}
    <circle cx="${CENTER}" cy="${CENTER}" r="${RETINA_R}" fill="none" stroke="#000" stroke-width="120" opacity="0.28"/>
  </g>
</svg>`

  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`,
    lesions,
    attention: buildAttention(lesions, mulberry32(spec.seed + 7)),
  }
}

/**
 * Overlay geometry for an image we did not draw (a worker's own upload).
 * Positions are illustrative — the UI says so plainly on the result screen.
 */
export function syntheticOverlay(seed: number, counts: Findings, side: 'left' | 'right') {
  const rand = mulberry32(seed)
  const lesions = buildLesions(rand, counts, side === 'right' ? 700 : 300)
  return { lesions, attention: buildAttention(lesions, mulberry32(seed + 7)) }
}

/* ---------------------------------------------------------------------------
   Pseudo-URLs. Seeded images are stored as a spec, not as a 20 KB data URI,
   so the offline queue and Supabase rows stay small. Uploads are stored as
   real data URIs and pass straight through.
--------------------------------------------------------------------------- */

export const FUNDUS_SCHEME = 'fundus://'

export function specToUrl(spec: FundusSpec): string {
  const { microaneurysm: ma, haemorrhage: he, hard_exudate: hx, neovascularisation: nv } =
    spec.counts
  return `${FUNDUS_SCHEME}${spec.seed}/${spec.side}/${spec.flavour}/${ma}-${he}-${hx}-${nv}`
}

export function parseFundusUrl(url: string): FundusSpec | null {
  if (!url.startsWith(FUNDUS_SCHEME)) return null
  const [seed, side, flavour, counts] = url.slice(FUNDUS_SCHEME.length).split('/')
  const [ma, he, hx, nv] = counts.split('-').map(Number)
  return {
    seed: Number(seed),
    side: side as FundusSpec['side'],
    flavour: flavour as QualityFlavour,
    counts: { microaneurysm: ma, haemorrhage: he, hard_exudate: hx, neovascularisation: nv },
  }
}

const renderCache = new Map<string, string>()

/** Turns a stored image reference into something an <img src> can display. */
export function resolveFundusSrc(url: string): string {
  if (!url.startsWith(FUNDUS_SCHEME)) return url
  const cached = renderCache.get(url)
  if (cached) return cached
  const spec = parseFundusUrl(url)
  if (!spec) return url
  const src = buildFundus(spec).src
  renderCache.set(url, src)
  return src
}
