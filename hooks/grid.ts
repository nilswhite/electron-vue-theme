// The faint dot grid behind the conversation: the Electron Vue editor color
// with a dot every 20 points and a slightly brighter one every 100, like
// graph paper. Still: nothing in it moves.

/** Electron Vue's editor background: what the chat should look like. */
export const BASE = '#212836'
/** Electron Vue's side bar: the color of the glass laid over the backdrop. */
export const PANEL = '#1b212c'

/**
 * The glass both apps lay over the backdrop, the conversation included. No
 * blur: a blurred veil would smear the dots into haze.
 */
export const GLASS = { blur: 0, tint: PANEL, opacity: 0.6 } as const

const INK = '#d1dfff'
const MINOR_INK = 0.11
const MAJOR_INK = 0.2
const STEP = 20
const MAJOR_EVERY = 5

type Rgb = [number, number, number]

export function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16)

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hex([r, g, b]: Rgb): string {
  const channel = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')

  return `#${channel(r)}${channel(g)}${channel(b)}`
}

function mix(from: string, to: string, amount: number): Rgb {
  const a = rgb(from)
  const b = rgb(to)

  return [0, 1, 2].map(i => a[i]! + (b[i]! - a[i]!) * amount) as Rgb
}

/**
 * The color to draw under the glass so the color seen through it is `seen`:
 * the glass lays `GLASS.tint` at `GLASS.opacity` over the scene.
 */
function underGlass(seen: Rgb): string {
  const tint = rgb(GLASS.tint)
  const o = GLASS.opacity

  return hex([0, 1, 2].map(i => (seen[i]! - o * tint[i]!) / (1 - o)) as Rgb)
}

/** What a person should see: the editor color, faint dots and slightly brighter ones. */
export const SEEN = {
  base: BASE,
  minor: hex(mix(BASE, INK, MINOR_INK)),
  major: hex(mix(BASE, INK, MAJOR_INK)),
} as const

/** What is drawn beneath the glass to be seen as SEEN. */
export const DRAWN = {
  base: underGlass(rgb(SEEN.base)),
  minor: underGlass(rgb(SEEN.minor)),
  major: underGlass(rgb(SEEN.major)),
} as const

/** The backdrop scene: one SVG of two tiled patterns. */
export function grid(): string {
  const big = STEP * MAJOR_EVERY
  const at = STEP / 2

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">',
    '<defs>',
    `<pattern id="minor" width="${STEP}" height="${STEP}" patternUnits="userSpaceOnUse">`,
    `<circle cx="${at}" cy="${at}" r="0.9" fill="${DRAWN.minor}"/>`,
    '</pattern>',
    `<pattern id="major" width="${big}" height="${big}" patternUnits="userSpaceOnUse">`,
    `<circle cx="${at}" cy="${at}" r="1.3" fill="${DRAWN.major}"/>`,
    '</pattern>',
    '</defs>',
    `<rect width="1440" height="900" fill="${DRAWN.base}"/>`,
    '<rect width="1440" height="900" fill="url(#minor)"/>',
    '<rect width="1440" height="900" fill="url(#major)"/>',
    '</svg>',
  ].join('')
}
