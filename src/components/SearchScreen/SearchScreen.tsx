import { useMemo } from 'react'
import { ResultCard } from '../ResultCard/ResultCard'
import type { Song } from '../../types'
import './SearchScreen.css'

interface SearchScreenProps {
  query: string
  results: Song[]
  isSearching: boolean
  hasSearched: boolean
  selectingTrackId: number | null
  onQueryChange: (value: string) => void
  onSearch: (query: string) => Promise<void>
  onSelectSong: (song: Song) => void
}

export function SearchScreen({
  query,
  results,
  isSearching,
  hasSearched,
  selectingTrackId,
  onQueryChange,
  onSearch,
  onSelectSong,
}: SearchScreenProps) {
  const showTopLayout = hasSearched
  const trimmed = query.trim()
  const emptyMessage = useMemo(
    () => (hasSearched && !isSearching && results.length === 0 ? `No results for '${trimmed}'` : ''),
    [hasSearched, isSearching, results.length, trimmed],
  )

  return (
    <main className={`search-screen ${showTopLayout ? 'search-screen--top' : 'search-screen--center'}`}>
      <div className="search-screen__inner">
        <input
          className="search-screen__input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmed.length > 0) {
              void onSearch(trimmed)
            }
          }}
          placeholder="Search for a song…"
        />

        <section className="search-screen__results" aria-live="polite">
          {isSearching && (
            <div className="loading-dots" aria-label="Loading">
              <span />
              <span />
              <span />
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="results-grid">
              {results.map((song) => (
                <ResultCard
                  key={song.trackId}
                  song={song}
                  onSelect={onSelectSong}
                  disabled={selectingTrackId === song.trackId}
                />
              ))}
            </div>
          )}

          {emptyMessage && <p className="search-screen__empty">{emptyMessage}</p>}
        </section>
      </div>
    </main>
  )
}
