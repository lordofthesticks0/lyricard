import { useEffect, useState } from 'react'
import { fetchArtworkAsDataUrl } from './api/artwork'
import { createDistortedBackgroundDataUrl } from './api/distort'
import { searchSongs } from './api/itunes'
import { extractPalette, textColorForBackground, type PaletteSwatch } from './api/vibrant'
import { EditorScreen } from './components/EditorScreen/EditorScreen'
import { LyricsScreen } from './components/LyricsScreen/LyricsScreen'
import { SearchScreen } from './components/SearchScreen/SearchScreen'
import type { CardOptions, LyricsData, Song } from './types'

type Step = 'search' | 'lyrics' | 'editor'

const DEFAULT_OPTIONS: CardOptions = {
  showArtist: true,
  showAlbum: true,
  showArtwork: true,
  showProgressBar: true,
  backgroundMode: 'blurred',
  solidColor: '#C2661D',
  aspectRatio: 'classic',
  layoutMode: 'default',
  titleText: '',
  artistText: '',
  albumText: '',
  artworkScale: 1,
  titleFontScale: 1,
  artistFontScale: 1,
  albumFontScale: 1,
  lyricsFontScale: 1,
  lyricsSpacing: 1,
  progressFontScale: 1,
  customProgressPercent: null,
  backgroundBlur: 70,
}

function App() {
  const [step, setStep] = useState<Step>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectingTrackId, setSelectingTrackId] = useState<number | null>(null)

  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [artworkDataUrl, setArtworkDataUrl] = useState('')
  const [backgroundArtworkDataUrl, setBackgroundArtworkDataUrl] = useState('')
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null)
  const [options, setOptions] = useState<CardOptions>(DEFAULT_OPTIONS)

  const [palette, setPalette] = useState<PaletteSwatch[]>([])
  const [selectedPaletteSwatch, setSelectedPaletteSwatch] = useState<string | null>(null)
  const [solidTextColor, setSolidTextColor] = useState('#FAFAFA')

  useEffect(() => {
    if (!artworkDataUrl) {
      setBackgroundArtworkDataUrl('')
      return
    }

    let cancelled = false
    setBackgroundArtworkDataUrl(artworkDataUrl)

    const seedA = selectedSong?.trackId ?? 17.93
    const seedB = (selectedSong?.trackId ?? 17.93) + 101.7

    void createDistortedBackgroundDataUrl(artworkDataUrl, {
      freq: 2.1,
      amplitudePx: 220,
      seedA,
      seedB,
    })
      .then((distorted) => {
        if (!cancelled) {
          setBackgroundArtworkDataUrl(distorted)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackgroundArtworkDataUrl(artworkDataUrl)
        }
      })

    return () => {
      cancelled = true
    }
  }, [artworkDataUrl, selectedSong?.trackId])

  const handleSearch = async (query: string) => {
    setIsSearching(true)
    setHasSearched(true)
    try {
      const songs = await searchSongs(query)
      setSearchResults(songs)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSongSelect = async (song: Song) => {
    setSelectingTrackId(song.trackId)
    try {
      let songArtworkDataUrl = ''
      let hasArtwork = song.artworkUrlLarge.length > 0

      if (hasArtwork) {
        try {
          songArtworkDataUrl = await fetchArtworkAsDataUrl(song.artworkUrlLarge)
        } catch {
          hasArtwork = false
        }
      }

      const nextOptions: CardOptions = {
        ...DEFAULT_OPTIONS,
        showArtwork: hasArtwork,
        backgroundMode: hasArtwork ? 'blurred' : 'solid',
        titleText: song.trackName,
        artistText: song.artistName,
        albumText: song.collectionName,
      }

      setSelectedSong(song)
      setArtworkDataUrl(songArtworkDataUrl)
      setBackgroundArtworkDataUrl(songArtworkDataUrl)
      setLyricsData(null)
      setPalette([])
      setSelectedPaletteSwatch(null)
      setSolidTextColor(textColorForBackground(nextOptions.solidColor))
      setOptions(nextOptions)
      setStep('lyrics')
    } finally {
      setSelectingTrackId(null)
    }
  }

  const handleLyricsContinue = (data: LyricsData) => {
    setLyricsData(data)
    setStep('editor')

    if (!artworkDataUrl) {
      return
    }

    void extractPalette(artworkDataUrl)
      .then((swatches) => {
        setPalette(swatches)
        const primary = swatches[0]
        if (primary) {
          setOptions((prev) => ({ ...prev, solidColor: primary.hex }))
          setSelectedPaletteSwatch(primary.name)
          setSolidTextColor(primary.textColor)
          return
        }

        setOptions((prev) => ({ ...prev, solidColor: '#C2661D' }))
        setSelectedPaletteSwatch(null)
        setSolidTextColor(textColorForBackground('#C2661D'))
      })
      .catch(() => {
        setPalette([])
        setOptions((prev) => ({ ...prev, solidColor: '#C2661D' }))
        setSelectedPaletteSwatch(null)
        setSolidTextColor(textColorForBackground('#C2661D'))
      })
  }

  if (step === 'search') {
    return (
      <SearchScreen
        hasSearched={hasSearched}
        query={searchQuery}
        isSearching={isSearching}
        selectingTrackId={selectingTrackId}
        results={searchResults}
        onQueryChange={setSearchQuery}
        onSearch={handleSearch}
        onSelectSong={handleSongSelect}
      />
    )
  }

  if (step === 'lyrics' && selectedSong) {
    return (
      <LyricsScreen
        song={selectedSong}
        onBack={() => setStep('search')}
        onContinue={handleLyricsContinue}
      />
    )
  }

  if (step === 'editor' && selectedSong && lyricsData) {
    return (
      <EditorScreen
        song={selectedSong}
        lyricsData={lyricsData}
        artworkDataUrl={artworkDataUrl}
        backgroundArtworkDataUrl={backgroundArtworkDataUrl}
        options={options}
        palette={palette}
        selectedPaletteSwatch={selectedPaletteSwatch}
        solidTextColor={solidTextColor}
        onOptionsChange={setOptions}
        onBack={() => setStep('lyrics')}
        onLyricsDataChange={setLyricsData}
        onPaletteSelect={(swatch) => {
          setOptions((prev) => ({ ...prev, solidColor: swatch.hex }))
          setSelectedPaletteSwatch(swatch.name)
          setSolidTextColor(swatch.textColor)
        }}
        onCustomColorSelect={(hex) => {
          setOptions((prev) => ({ ...prev, solidColor: hex }))
          setSelectedPaletteSwatch(null)
          setSolidTextColor(textColorForBackground(hex))
        }}
      />
    )
  }

  return null
}

export default App
