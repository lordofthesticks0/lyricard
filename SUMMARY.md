**Everything besides this line is LLM generated.**
# Lyricard - Technical Architecture & Detailed Project Overview

---

## 1. High-Level Architecture & Workflow

Lyricard operates as a multi-step single-page application (SPA). The app flow is split into three distinct states managed via [`App.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/App.tsx):

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  SearchScreen   │ ────► │  LyricsScreen   │ ────► │  EditorScreen   │
│  (iTunes API)   │       │  (LRCLIB API)   │       │(Canvas & Render)│
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Search Screen ([`SearchScreen.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/SearchScreen/SearchScreen.tsx))**:
   - Accepts track or artist search queries.
   - Queries the iTunes Search API ([`src/api/itunes.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/itunes.ts)) to display metadata (track title, artist, album name, high-resolution artwork URLs, and track duration).
2. **Lyrics Selection Screen ([`LyricsScreen.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/LyricsScreen/LyricsScreen.tsx))**:
   - Queries LRCLIB ([`src/api/lrclib.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/lrclib.ts)) using track, artist, and album metadata.
   - Parses `.lrc` timestamped lyrics or plain text lyrics.
   - Allows users to select specific lyric lines to feature on the card or manually edit/type custom lyrics.
3. **Editor & Export Screen ([`EditorScreen.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/EditorScreen/EditorScreen.tsx))**:
   - Real-time live preview of the Lyricard ([`LyricCard.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/LyricCard/LyricCard.tsx)).
   - Granular visual controls via [`ControlPanel`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/ControlPanel/ControlPanel.tsx): layout mode, aspect ratios, image scaling, font sizing, custom progress bar position, blurred or solid background modes, color palette picking (`node-vibrant`), and blur depth.
   - High-fidelity image rendering and file download using `html-to-image` ([`ResultCard.tsx`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/ResultCard/ResultCard.tsx)).

---

## 2. Directory Structure & Key Files

```
lyricard/
├── index.html                  # Main HTML template
├── package.json                # Project dependencies (React 19, Vite, html-to-image, node-vibrant, oxlint)
├── tsconfig.json               # TypeScript base configuration
├── vite.config.ts              # Vite bundle configuration
└── src/
    ├── App.tsx                 # Main application state machine & step manager
    ├── main.tsx                # React root entry point
    ├── types.ts                # TypeScript domain models and default constants
    ├── api/
    │   ├── artwork.ts          # Cross-origin image fetching & Data URL converter
    │   ├── distort.ts          # HTML5 Canvas perlin-like mathematical background distortion
    │   ├── itunes.ts           # iTunes Search API client
    │   ├── lrclib.ts           # LRCLIB API client and LRC timestamp parser
    │   └── vibrant.ts          # Color palette extraction utility wrapping node-vibrant
    └── components/
        ├── SearchScreen/       # Song search UI component
        ├── LyricsScreen/       # Lyric line selection & manual editor UI component
        ├── EditorScreen/       # Layout split container (ControlPanel + LyricCard preview)
        ├── ControlPanel/       # Multi-tab customization sidebar (Layout, Typography, Background, Artwork)
        ├── LyricCard/          # Core visual card renderer (Artwork, Lyrics text, Progress bar)
        └── ResultCard/         # Export logic container using html-to-image
```

---

## 3. Core Technical Features & Implementations

### 3.1. Audio Metadata & Lyrics Fetching (`src/api/`)
- **iTunes Search API ([`itunes.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/itunes.ts))**: Queries `https://itunes.apple.com/search` with entity parameter `song`. Automatically upgrades low-res artwork URLs (e.g., `100x100bb.jpg`) to high-resolution variants (`1000x1000bb.jpg`).
- **LRCLIB Integration ([`lrclib.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/lrclib.ts))**: Searches `https://lrclib.net/api/search`. Implements a fallback strategy: first searching with `album_name`, and if empty, falling back to matching by track and artist alone.
- **LRC Parser ([`lrclib.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/lrclib.ts))**: Uses regular expression regex `^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$` to parse centiseconds, convert timestamps into decimal seconds, and extract clean lyric text.

### 3.2. Background Distortion & Canvas Processing ([`src/api/distort.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/distort.ts))
- Generates smooth, aesthetic, organic background textures based on the track's album cover art.
- Uses offscreen HTML5 `CanvasRenderingContext2D` to sample pixel data from album artwork.
- Applies dual-frequency trigonometric noise functions with seed values tied to the track ID (`seedA` and `seedB`) to perturb pixel positions and calculate dynamic background swirls.

### 3.3. Dynamic Palette Extraction ([`src/api/vibrant.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/api/vibrant.ts))
- Uses `node-vibrant` to analyze album artwork colors.
- Extracts prominent swatches (`Vibrant`, `Muted`, `DarkVibrant`, `LightVibrant`, `DarkMuted`, `LightMuted`).
- Calculates relative luminance ($Y = 0.2126R + 0.7152G + 0.0722B$) to determine whether foreground text should render as light (`#FAFAFA`) or dark (`#121212`) for high contrast readability.

### 3.4. Flexible Aspect Ratios & Card Layouts ([`src/types.ts`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/types.ts))
Lyricard supports multiple presets:
- **Classic**: $1280 \times 800$ (16:10)
- **Square**: $1080 \times 1080$ (1:1)
- **Portrait**: $1080 \times 1350$ (4:5)
- **Story**: $1080 \times 1920$ (9:16)
- **Widescreen**: $1920 \times 1080$ (16:9)

### 3.5. High-Resolution Card Export ([`src/components/ResultCard/`](file:///A:/Users/fachr/Documents/Projects/lyricard/src/components/ResultCard/))
- Uses `html-to-image` (`toPng`, `toJpeg`) to serialize the DOM subtree of `#lyric-card-export`.
- Automatically scales export resolution based on native canvas pixel dimensions to ensure sharp images regardless of device pixel ratios.

---

## 4. Tech Stack & Dependencies

- **Frontend Library**: React 19 (`react`, `react-dom`)
- **Language**: TypeScript 6
- **Build Tool**: Vite 8
- **Linter**: Oxlint
- **Image Generation**: `html-to-image`
- **Color Extraction**: `node-vibrant`

---

## 5. Development & Scripts

- **Start Development Server**: `npm run dev`
- **Typecheck & Build**: `npm run build`
- **Lint Codebase**: `npm run lint`
- **Preview Production Build**: `npm run preview`
