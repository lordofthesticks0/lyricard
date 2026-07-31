import type { PaletteSwatch } from '../../api/vibrant'
import type { AspectRatioKey, CardOptions, LyricsData } from '../../types'
import { ASPECT_RATIOS } from '../../types'
import './ControlPanel.css'

interface ControlPanelProps {
  options: CardOptions
  lyricsData: LyricsData
  palette: PaletteSwatch[]
  selectedPaletteSwatch: string | null
  onToggle: (key: keyof Pick<CardOptions, 'showArtist' | 'showAlbum' | 'showArtwork' | 'showProgressBar'>) => void
  onTextChange: (
    key: keyof Pick<CardOptions, 'titleText' | 'artistText' | 'albumText'>,
    value: string,
  ) => void
  onScaleChange: (
    key: keyof Pick<
      CardOptions,
      | 'artworkScale'
      | 'titleFontScale'
      | 'artistFontScale'
      | 'albumFontScale'
      | 'lyricsFontScale'
      | 'progressFontScale'
      | 'backgroundBlur'
    >,
    value: number,
  ) => void
  onProgressPositionChange: (value: number | null) => void
  onBackgroundModeChange: (mode: CardOptions['backgroundMode']) => void
  onPaletteSelect: (swatch: PaletteSwatch) => void
  onCustomColorSelect: (hex: string) => void
  onAspectRatioChange: (ratio: AspectRatioKey) => void
  onLayoutModeChange: (mode: CardOptions['layoutMode']) => void
  onLyricsLineChange: (lineIndex: number, text: string) => void
}

function ToggleRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: boolean
  onClick: () => void
}) {
  return (
    <div className="toggle-row">
      <span className="toggle-row__label">{label}</span>
      <button type="button" className="switch" data-on={value} onClick={onClick}>
        <span className="switch__knob" />
      </button>
    </div>
  )
}

export function ControlPanel({
  options,
  lyricsData,
  palette,
  selectedPaletteSwatch,
  onToggle,
  onTextChange,
  onScaleChange,
  onProgressPositionChange,
  onBackgroundModeChange,
  onPaletteSelect,
  onCustomColorSelect,
  onAspectRatioChange,
  onLayoutModeChange,
  onLyricsLineChange,
}: ControlPanelProps) {
  const selectedLines = lyricsData.lines.filter((line) => line.selected)

  return (
    <aside className="control-panel">
      <section className="control-group">
        <h3 className="control-group__label">Visibility</h3>
        <ToggleRow label="Artist name" value={options.showArtist} onClick={() => onToggle('showArtist')} />
        <ToggleRow label="Album name" value={options.showAlbum} onClick={() => onToggle('showAlbum')} />
        <ToggleRow label="Album cover" value={options.showArtwork} onClick={() => onToggle('showArtwork')} />
        <ToggleRow
          label="Progress bar"
          value={options.showProgressBar}
          onClick={() => onToggle('showProgressBar')}
        />
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Background</h3>
        <div className="segmented">
          <button
            type="button"
            className="segmented__option"
            data-active={options.backgroundMode === 'blurred'}
            onClick={() => onBackgroundModeChange('blurred')}
          >
            Apple Music (blurred)
          </button>
          <button
            type="button"
            className="segmented__option"
            data-active={options.backgroundMode === 'solid'}
            onClick={() => onBackgroundModeChange('solid')}
          >
            Spotify (solid)
          </button>
        </div>
      </section>

      {options.backgroundMode === 'solid' && (
        <section className="control-group">
          <h3 className="control-group__label">Color</h3>
          <div className="palette-row">
            {palette.map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                className="palette-swatch"
                data-selected={selectedPaletteSwatch === swatch.name}
                style={{ backgroundColor: swatch.hex }}
                onClick={() => onPaletteSelect(swatch)}
                aria-label={`Select ${swatch.name} color`}
              />
            ))}
            <label className="palette-swatch palette-swatch--custom" data-selected={selectedPaletteSwatch === null}>
              +
              <input
                type="color"
                value={options.solidColor}
                className="palette-swatch__input"
                onChange={(event) => onCustomColorSelect(event.target.value)}
              />
            </label>
          </div>
        </section>
      )}

      <section className="control-group">
        <h3 className="control-group__label">Layout</h3>
        <div className="segmented">
          <button
            type="button"
            className="segmented__option"
            data-active={options.layoutMode === 'default'}
            onClick={() => onLayoutModeChange('default')}
          >
            Spotify
          </button>
          <button
            type="button"
            className="segmented__option"
            data-active={options.layoutMode === 'stacked'}
            onClick={() => onLayoutModeChange('stacked')}
          >
            Alternative
          </button>
        </div>
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Text</h3>
        <div className="field-stack">
          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="field__input"
              value={options.titleText}
              onChange={(event) => onTextChange('titleText', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Artist</span>
            <input
              className="field__input"
              value={options.artistText}
              onChange={(event) => onTextChange('artistText', event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Album</span>
            <input
              className="field__input"
              value={options.albumText}
              onChange={(event) => onTextChange('albumText', event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Lyrics text</h3>
        <div className="field-stack">
          {selectedLines.length === 0 ? (
            <p className="field__helper">No selected lines to edit.</p>
          ) : (
            selectedLines.map((line, index) => (
              <label key={line.index} className="field">
                <span className="field__label">Line {index + 1}</span>
                <textarea
                  className="field__input field__input--textarea"
                  value={line.text}
                  onChange={(event) => onLyricsLineChange(line.index, event.target.value)}
                  rows={2}
                />
              </label>
            ))
          )}
        </div>
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Sizes</h3>
        <div className="slider-stack">
          <label className="slider-row">
            <span>Album cover</span>
            <input
              type="range"
              min="0.7"
              max="3.5"
              step="0.01"
              value={options.artworkScale}
              onChange={(event) => onScaleChange('artworkScale', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Background blur</span>
            <input
              type="range"
              min="0"
              max="140"
              step="1"
              value={options.backgroundBlur}
              onChange={(event) => onScaleChange('backgroundBlur', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Title font</span>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.01"
              value={options.titleFontScale}
              onChange={(event) => onScaleChange('titleFontScale', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Artist font</span>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.01"
              value={options.artistFontScale}
              onChange={(event) => onScaleChange('artistFontScale', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Album font</span>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.01"
              value={options.albumFontScale}
              onChange={(event) => onScaleChange('albumFontScale', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Lyrics font</span>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.01"
              value={options.lyricsFontScale}
              onChange={(event) => onScaleChange('lyricsFontScale', Number(event.target.value))}
            />
          </label>
          <label className="slider-row">
            <span>Time font</span>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.01"
              value={options.progressFontScale}
              onChange={(event) => onScaleChange('progressFontScale', Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Time slider position</h3>
        <div className="slider-stack">
          <label className="slider-row">
            <span>Auto from lyrics</span>
            <input
              type="checkbox"
              checked={options.customProgressPercent === null}
              onChange={(event) => {
                if (event.target.checked) {
                  onProgressPositionChange(null)
                } else {
                  onProgressPositionChange(0)
                }
              }}
            />
          </label>
          <label className="slider-row">
            <span>Position</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={options.customProgressPercent ?? 0}
              disabled={options.customProgressPercent === null}
              onChange={(event) => onProgressPositionChange(Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="control-group">
        <h3 className="control-group__label">Aspect ratio</h3>
        <div className="segmented segmented--wrap">
          {Object.entries(ASPECT_RATIOS).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className="segmented__option segmented__option--ratio"
              data-active={options.aspectRatio === key}
              onClick={() => onAspectRatioChange(key as AspectRatioKey)}
            >
              {config.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
