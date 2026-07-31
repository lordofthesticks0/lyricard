import { formatDuration } from '../../api/itunes'
import type { Song } from '../../types'
import './ResultCard.css'

interface ResultCardProps {
  song: Song
  disabled?: boolean
  onSelect: (song: Song) => void
}

export function ResultCard({ song, disabled = false, onSelect }: ResultCardProps) {
  return (
    <button
      type="button"
      className="result-card"
      onClick={() => onSelect(song)}
      disabled={disabled}
      aria-label={`Select ${song.trackName} by ${song.artistName}`}
    >
      {song.artworkUrlSmall ? (
        <img className="result-card__art" src={song.artworkUrlSmall} alt="" />
      ) : (
        <div className="result-card__art result-card__art--placeholder" aria-hidden="true" />
      )}
      <div className="result-card__meta">
        <div className="result-card__title">{song.trackName}</div>
        <div className="result-card__subtitle">
          {song.artistName} · {song.collectionName}
        </div>
      </div>
      <div className="result-card__duration">{formatDuration(song.durationMs)}</div>
    </button>
  )
}
