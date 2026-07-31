import { useMemo, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { toJpeg, toPng } from 'html-to-image'
import { ControlPanel } from '../ControlPanel/ControlPanel'
import { LyricCard } from '../LyricCard/LyricCard'
import type { PaletteSwatch } from '../../api/vibrant'
import { ASPECT_RATIOS, type AspectRatioKey, type CardOptions, type LyricsData, type Song } from '../../types'
import './EditorScreen.css'

const PREVIEW_MAX_WIDTH = 480

interface EditorScreenProps {
  song: Song
  lyricsData: LyricsData
  artworkDataUrl: string
  backgroundArtworkDataUrl: string
  options: CardOptions
  palette: PaletteSwatch[]
  selectedPaletteSwatch: string | null
  solidTextColor: string
  onOptionsChange: Dispatch<SetStateAction<CardOptions>>
  onLyricsDataChange: Dispatch<SetStateAction<LyricsData | null>>
  onPaletteSelect: (swatch: PaletteSwatch) => void
  onCustomColorSelect: (hex: string) => void
}

async function exportCard(node: HTMLElement, format: 'png' | 'jpg') {
  const options = { cacheBust: true, pixelRatio: 1 }
  const dataUrl =
    format === 'png'
      ? await toPng(node, options)
      : await toJpeg(node, { ...options, quality: 0.95, backgroundColor: '#000000' })

  const link = document.createElement('a')
  link.download = `lyric-card.${format}`
  link.href = dataUrl
  link.click()
}

function CardPreviewFrame({
  trueWidth,
  trueHeight,
  children,
}: {
  trueWidth: number
  trueHeight: number
  children: ReactNode
}) {
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / trueWidth)
  return (
    <div style={{ width: trueWidth * scale, height: trueHeight * scale, overflow: 'hidden' }}>
      <div
        style={{
          width: trueWidth,
          height: trueHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function EditorScreen({
  song,
  lyricsData,
  artworkDataUrl,
  backgroundArtworkDataUrl,
  options,
  palette,
  selectedPaletteSwatch,
  solidTextColor,
  onOptionsChange,
  onLyricsDataChange,
  onPaletteSelect,
  onCustomColorSelect,
}: EditorScreenProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const ratio = ASPECT_RATIOS[options.aspectRatio]
  const hasArtwork = artworkDataUrl.length > 0

  const effectiveOptions = useMemo<CardOptions>(
    () => ({
      ...options,
      showArtwork: hasArtwork ? options.showArtwork : false,
      backgroundMode: hasArtwork ? options.backgroundMode : 'solid',
    }),
    [hasArtwork, options],
  )

  return (
    <main className="editor-screen">
      <section className="editor-screen__preview-column">
        <CardPreviewFrame trueWidth={ratio.width} trueHeight={ratio.height}>
          <LyricCard
            ref={cardRef}
            song={song}
            lyricsData={lyricsData}
            artworkDataUrl={artworkDataUrl}
            backgroundArtworkDataUrl={backgroundArtworkDataUrl}
            options={effectiveOptions}
            solidTextColor={solidTextColor}
          />
        </CardPreviewFrame>

        <div className="export-buttons">
          <button
            type="button"
            className="export-button export-button--primary"
            onClick={() => cardRef.current && exportCard(cardRef.current, 'png')}
          >
            Download PNG
          </button>
          <button
            type="button"
            className="export-button export-button--secondary"
            onClick={() => cardRef.current && exportCard(cardRef.current, 'jpg')}
          >
            Download JPG
          </button>
        </div>
      </section>

      <ControlPanel
        options={effectiveOptions}
        lyricsData={lyricsData}
        palette={palette}
        selectedPaletteSwatch={selectedPaletteSwatch}
        onToggle={(key) => onOptionsChange((prev) => ({ ...prev, [key]: !prev[key] }))}
        onTextChange={(key, value) => onOptionsChange((prev) => ({ ...prev, [key]: value }))}
        onScaleChange={(key, value) => onOptionsChange((prev) => ({ ...prev, [key]: value }))}
        onProgressPositionChange={(value) =>
          onOptionsChange((prev) => ({ ...prev, customProgressPercent: value }))
        }
        onBackgroundModeChange={(mode) => onOptionsChange((prev) => ({ ...prev, backgroundMode: mode }))}
        onPaletteSelect={onPaletteSelect}
        onCustomColorSelect={onCustomColorSelect}
        onAspectRatioChange={(ratioKey: AspectRatioKey) =>
          onOptionsChange((prev) => ({ ...prev, aspectRatio: ratioKey }))
        }
        onLayoutModeChange={(mode) => onOptionsChange((prev) => ({ ...prev, layoutMode: mode }))}
        onLyricsLineChange={(lineIndex, text) =>
          onLyricsDataChange((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              lines: prev.lines.map((line) => (line.index === lineIndex ? { ...line, text } : line)),
            }
          })
        }
      />
    </main>
  )
}
