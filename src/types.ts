export interface Song {
  trackId: number
  trackName: string
  artistName: string
  collectionName: string
  artworkUrlSmall: string
  artworkUrlLarge: string
  durationMs: number
}

export interface LyricLine {
  index: number
  time: number | null
  text: string
  selected: boolean
}

export interface LyricsData {
  lines: LyricLine[]
  isTimeSynced: boolean
}

export type AspectRatioKey = 'classic' | 'square' | 'portrait' | 'story' | 'widescreen'

export type BackgroundMode = 'blurred' | 'solid'

export interface CardOptions {
  showArtist: boolean
  showAlbum: boolean
  showArtwork: boolean
  showProgressBar: boolean
  backgroundMode: BackgroundMode
  solidColor: string
  aspectRatio: AspectRatioKey
  layoutMode: 'default' | 'stacked'
  titleText: string
  artistText: string
  albumText: string
  artworkScale: number
  titleFontScale: number
  artistFontScale: number
  albumFontScale: number
  lyricsFontScale: number
  progressFontScale: number
  customProgressPercent: number | null
  backgroundBlur: number
}

export const ASPECT_RATIOS: Record<
  AspectRatioKey,
  { label: string; width: number; height: number }
> = {
  classic: { label: 'Classic', width: 1280, height: 800 },
  square: { label: 'Square', width: 1080, height: 1080 },
  portrait: { label: 'Portrait', width: 1080, height: 1350 },
  story: { label: 'Story', width: 1080, height: 1920 },
  widescreen: { label: 'Widescreen', width: 1920, height: 1080 },
}
