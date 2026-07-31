import { upscaleArtwork } from './artwork'
import type { Song } from '../types'

interface ItunesSongResult {
  trackId?: number
  trackName?: string
  artistName?: string
  collectionName?: string
  artworkUrl100?: string
  trackTimeMillis?: number
}

interface ItunesSearchResponse {
  results?: ItunesSongResult[]
}

export async function searchSongs(query: string): Promise<Song[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=50`
  const response = await fetch(url)
  const data = (await response.json()) as ItunesSearchResponse

  return (data.results ?? [])
    .filter(
      (item): item is Required<
        Pick<
          ItunesSongResult,
          'trackId' | 'trackName' | 'artistName' | 'collectionName' | 'trackTimeMillis'
        >
      > &
        Pick<ItunesSongResult, 'artworkUrl100'> =>
        typeof item.trackId === 'number' &&
        typeof item.trackName === 'string' &&
        typeof item.artistName === 'string' &&
        typeof item.collectionName === 'string' &&
        typeof item.trackTimeMillis === 'number',
    )
    .map((item) => ({
      trackId: item.trackId,
      trackName: item.trackName,
      artistName: item.artistName,
      collectionName: item.collectionName,
      artworkUrlSmall: item.artworkUrl100 ?? '',
      artworkUrlLarge: item.artworkUrl100 ? upscaleArtwork(item.artworkUrl100) : '',
      durationMs: item.trackTimeMillis,
    }))
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatSeconds(seconds: number): string {
  return formatDuration(seconds * 1000)
}
