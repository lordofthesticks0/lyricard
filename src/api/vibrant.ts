import { Vibrant } from 'node-vibrant/browser'

export interface PaletteSwatch {
  name: 'Vibrant' | 'LightVibrant' | 'DarkVibrant' | 'Muted' | 'LightMuted' | 'DarkMuted'
  hex: string
  textColor: string
}

const SWATCH_PRIORITY = [
  'Vibrant',
  'LightVibrant',
  'Muted',
  'DarkVibrant',
  'DarkMuted',
  'LightMuted',
] as const

export async function extractPalette(artworkDataUrl: string): Promise<PaletteSwatch[]> {
  const palette = await Vibrant.from(artworkDataUrl).getPalette()
  return SWATCH_PRIORITY.filter((name) => palette[name] != null).map((name) => ({
    name,
    hex: palette[name]!.hex,
    textColor: palette[name]!.titleTextColor,
  }))
}

export function textColorForBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return brightness > 0.6 ? '#141414' : '#FAFAFA'
}
