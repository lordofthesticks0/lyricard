import { useEffect, useMemo, useState } from 'react'
import { fetchLyrics } from '../../api/lrclib'
import { formatSeconds } from '../../api/itunes'
import type { LyricsData, Song } from '../../types'
import './LyricsScreen.css'

interface LyricsScreenProps {
  song: Song
  onBack: () => void
  onContinue: (lyrics: LyricsData) => void
}

export function LyricsScreen({ song, onBack, onContinue }: LyricsScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [hasNoLyrics, setHasNoLyrics] = useState(false)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setHasNoLyrics(false)
    setLyrics(null)

    void fetchLyrics(song)
      .then((data) => {
        if (!active) return
        if (!data || data.lines.length === 0) {
          setHasNoLyrics(true)
          return
        }
        setLyrics(data)
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [song])

  const selectedCount = useMemo(
    () => lyrics?.lines.filter((line) => line.selected).length ?? 0,
    [lyrics],
  )

  const toggleLine = (lineIndex: number) => {
    setLyrics((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        lines: prev.lines.map((line) =>
          line.index === lineIndex ? { ...line, selected: !line.selected } : line,
        ),
      }
    })
  }

  return (
    <main className="lyrics-screen">
      <div className="lyrics-screen__inner">
        <p className="lyrics-screen__context">
          {song.trackName} · {song.artistName}
        </p>

        {isLoading && (
          <div className="loading-dots" aria-label="Loading">
            <span />
            <span />
            <span />
          </div>
        )}

        {!isLoading && hasNoLyrics && (
          <div className="lyrics-screen__empty">
            <p>No lyrics found for this track — go back and try another match</p>
            <button type="button" className="lyrics-screen__back-btn" onClick={onBack}>
              Back to Search
            </button>
          </div>
        )}

        {!isLoading && lyrics && (
          <>
            <div className="lyrics-screen__list">
              {lyrics.lines.map((line) => (
                <button
                  key={`${line.index}-${line.text}`}
                  type="button"
                  className={`lyric-line-option ${line.selected ? 'lyric-line-option--selected' : ''}`}
                  onClick={() => toggleLine(line.index)}
                >
                  <span className="lyric-line-option__time">
                    {line.time !== null ? formatSeconds(line.time) : ''}
                  </span>
                  <span>{line.text}</span>
                </button>
              ))}
            </div>

            <p className="lyrics-screen__hint">Tip: 1–4 lines look best on the card.</p>

            <div className="lyrics-screen__sticky">
              <button
                type="button"
                className="lyrics-screen__continue-btn"
                disabled={selectedCount === 0}
                onClick={() => lyrics && onContinue(lyrics)}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
