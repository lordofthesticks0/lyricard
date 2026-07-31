import { forwardRef, useMemo, type CSSProperties } from 'react'
import { formatDuration } from '../../api/itunes'
import { useLyricFontTier } from '../../hooks/useLyricFontTier'
import { ASPECT_RATIOS, type CardOptions, type LyricsData, type Song } from '../../types'
import './LyricCard.css'

interface LyricCardProps {
  song: Song
  lyricsData: LyricsData
  artworkDataUrl: string
  backgroundArtworkDataUrl: string
  options: CardOptions
  solidTextColor: string
}

function computeProgress(
  song: Song,
  lines: LyricsData['lines'],
  isTimeSynced: boolean,
  customProgressPercent: number | null,
) {
  if (customProgressPercent !== null) {
    const clamped = Math.max(0, Math.min(100, customProgressPercent))
    const seconds = (clamped / 100) * (song.durationMs / 1000)
    return { percent: clamped, currentTimeLabel: formatDuration(seconds * 1000) }
  }

  const selected = lines.filter((line) => line.selected).sort((a, b) => a.index - b.index)
  const anchor = selected[0]
  if (!anchor) return { percent: 0, currentTimeLabel: '' }

  if (isTimeSynced && anchor.time !== null) {
    const percent = Math.min(100, (anchor.time / (song.durationMs / 1000)) * 100)
    return { percent, currentTimeLabel: formatDuration(anchor.time * 1000) }
  }

  const totalLines = lines.length
  const percent = totalLines > 1 ? (anchor.index / (totalLines - 1)) * 100 : 0
  return { percent, currentTimeLabel: '' }
}

export const LyricCard = forwardRef<HTMLDivElement, LyricCardProps>(function LyricCard(
  { song, lyricsData, artworkDataUrl, backgroundArtworkDataUrl, options, solidTextColor },
  ref,
) {
  const selectedLines = useMemo(
    () => lyricsData.lines.filter((line) => line.selected).sort((a, b) => a.index - b.index),
    [lyricsData.lines],
  )
  const fontTier = useLyricFontTier(selectedLines)
  const ratio = ASPECT_RATIOS[options.aspectRatio]
  const progress = computeProgress(
    song,
    lyricsData.lines,
    lyricsData.isTimeSynced,
    options.customProgressPercent,
  )
  const textColor = options.backgroundMode === 'blurred' ? '#F5F5F5' : solidTextColor

  return (
    <div
      ref={ref}
      className="lyric-card"
      data-bg-mode={options.backgroundMode}
      data-layout-mode={options.layoutMode}
      style={
        {
          '--card-w': `${ratio.width}px`,
          '--card-h': `${ratio.height}px`,
          '--solid-color': options.solidColor,
          '--card-text-color': textColor,
          '--artwork-scale': options.artworkScale,
          '--font-scale-title': options.titleFontScale,
          '--font-scale-artist': options.artistFontScale,
          '--font-scale-album': options.albumFontScale,
          '--font-scale-lyrics': options.lyricsFontScale,
          '--lyrics-spacing': `${options.lyricsSpacing ?? 1}cqw`,
          '--font-scale-progress': options.progressFontScale,
          '--bg-blur': `${options.backgroundBlur}px`,
        } as CSSProperties
      }
    >
      <div className="lyric-card__bg">
        <div
          className="lyric-card__bg-image"
          style={{ backgroundImage: `url(${backgroundArtworkDataUrl || artworkDataUrl})` }}
        />
        <div className="lyric-card__bg-overlay" />
      </div>

      <div className="lyric-card__content">
        <header className="lyric-card__header">
          <img
            className="lyric-card__artwork"
            src={artworkDataUrl}
            alt=""
            style={{ display: options.showArtwork ? 'block' : 'none' }}
          />
          <div className="lyric-card__meta">
            <p className="lyric-card__title">{options.titleText}</p>
            <p className="lyric-card__artist" style={{ display: options.showArtist ? 'block' : 'none' }}>
              {options.artistText}
            </p>
            <p className="lyric-card__album" style={{ display: options.showAlbum ? 'block' : 'none' }}>
              {options.albumText}
            </p>
          </div>
        </header>

        <div className="lyric-card__progress" style={{ display: options.showProgressBar ? 'block' : 'none' }}>
          <div className="lyric-card__progress-track">
            <div className="lyric-card__progress-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="lyric-card__progress-labels">
            <span>{progress.currentTimeLabel}</span>
            <span>{formatDuration(song.durationMs)}</span>
          </div>
        </div>

        <div className={`lyric-card__lyrics lyric-card__lyrics--${fontTier}`}>
          {selectedLines.map((line) => (
            <p key={`${line.index}-${line.text}`} className="lyric-card__line">
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
})
