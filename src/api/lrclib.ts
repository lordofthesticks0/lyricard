import type { LyricLine, LyricsData, Song } from '../types'

const LRC_LINE = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/

interface LrclibResult {
  instrumental?: boolean
  plainLyrics?: string
  syncedLyrics?: string
}

function hasUsableLyrics(entry: LrclibResult): boolean {
  const plain = entry.plainLyrics?.trim() ?? ''
  const synced = entry.syncedLyrics?.trim() ?? ''
  return entry.instrumental === false && (plain.length > 0 || synced.length > 0)
}

export function parseSyncedLyrics(raw: string): LyricLine[] {
  return raw
    .split('\n')
    .map((line) => line.match(LRC_LINE))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m, index) => {
      const [, mm, ss, cs, text] = m
      const centiseconds = cs.length === 2 ? Number(cs) : Number(cs) / 10
      const time = Number(mm) * 60 + Number(ss) + centiseconds / 100
      return { index, time, text: text.trim(), selected: false }
    })
    .filter((line) => line.text.length > 0)
}

export function parsePlainLyrics(raw: string): LyricLine[] {
  return raw
    .split('\n')
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text, index) => ({ index, time: null, text, selected: false }))
}

async function searchLrclib(song: Song, withAlbum: boolean): Promise<LrclibResult[]> {
  const base = 'https://lrclib.net/api/search'
  const params = new URLSearchParams({
    track_name: song.trackName,
    artist_name: song.artistName,
  })
  if (withAlbum) {
    params.set('album_name', song.collectionName)
  }

  const response = await fetch(`${base}?${params.toString()}`)
  return (await response.json()) as LrclibResult[]
}

export async function fetchLyrics(song: Song): Promise<LyricsData | null> {
  const primaryResults = await searchLrclib(song, true)
  let match = primaryResults.find(hasUsableLyrics)

  if (!match && primaryResults.length === 0) {
    const fallbackResults = await searchLrclib(song, false)
    match = fallbackResults.find(hasUsableLyrics)
  }

  if (!match) {
    return null
  }

  const synced = match.syncedLyrics?.trim() ?? ''
  const plain = match.plainLyrics?.trim() ?? ''
  const lines = synced.length > 0 ? parseSyncedLyrics(synced) : parsePlainLyrics(plain)

  return {
    lines,
    isTimeSynced: lines.every((line) => line.time !== null),
  }
}
