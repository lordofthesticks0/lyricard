# Lyric Card Generator — Full Build Plan

This document is a complete, unambiguous implementation spec. It is written so an
implementer does not need to make any judgment calls — every color, size, gap,
API call, and data shape is specified. Follow it top to bottom. Where a decision
was made on the implementer's behalf, it's called out explicitly so it can be
changed later without hunting through code.

**Recommended stack:** React + Vite + TypeScript, plain CSS files (one per
component, co-located). No CSS framework — every rule you need is written out
below, so a framework would only add a translation step. `node-vibrant` for
palette extraction, `html-to-image` for PNG/JPG export.

---

## 1. App flow (4 screens, one linear path)

```
┌───────────────┐    song selected    ┌──────────────────┐   lines chosen   ┌───────────────┐
│  1. SEARCH     │ ──────────────────▶ │  2. LYRICS PICK   │ ───────────────▶ │  3. EDITOR     │
│  search box +  │                     │  fetch LRCLib,    │                   │  live card +   │
│  result grid   │                     │  click lines to   │                   │  toggles +     │
│  (combined)    │                     │  select           │                   │  export        │
└───────────────┘                     └──────────────────┘                   └───────────────┘
```

Note the brief describes 4 numbered steps, but steps 1 and 2 (search box +
selectable result cards) live on **one screen** — the results simply appear
below the search box once a search resolves. So there are 3 screens/routes:

- `/` — Search
- `/lyrics` — Lyrics line picker (only reachable after a song is chosen; keep
  the chosen song in state, don't use URL params for it)
- `/editor` — Card editor + export (only reachable after lines are chosen)

Use plain React state lifted in `App.tsx` (a `step` variable: `'search' |
'lyrics' | 'editor'`) rather than a router — this is a single-session tool,
there's nothing worth deep-linking to.

---

## 2. Data models

Put these in `src/types.ts`. Every other file imports from here — do not
redeclare shapes locally.

```ts
export interface Song {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string; // album
  artworkUrlSmall: string; // as returned by iTunes (100x100)
  artworkUrlLarge: string; // upscaled, see §4.3
  durationMs: number;
}

export interface LyricLine {
  index: number;        // position in the full lyric, 0-based
  time: number | null;  // seconds from track start; null = not time-synced
  text: string;
  selected: boolean;
}

export interface LyricsData {
  lines: LyricLine[];
  isTimeSynced: boolean; // true only if EVERY line has a non-null time
}

export type AspectRatioKey = 'classic' | 'square' | 'portrait' | 'story' | 'widescreen';

export type BackgroundMode = 'blurred' | 'solid';

export interface CardOptions {
  showArtist: boolean;
  showAlbum: boolean;
  showArtwork: boolean;
  showProgressBar: boolean;
  backgroundMode: BackgroundMode;
  solidColor: string; // hex, e.g. "#C2661D" — used only when backgroundMode === 'solid'
  aspectRatio: AspectRatioKey;
}
```

Default `CardOptions` when a song is first chosen:

```ts
{
  showArtist: true,
  showAlbum: true,
  showArtwork: true,
  showProgressBar: true,
  backgroundMode: 'blurred',   // per the brief, blurred is the default, solid is the toggle-off
  solidColor: '#C2661D',        // overwritten immediately by the vibrant-palette default, see §7.4
  aspectRatio: 'classic',
}
```

---

## 3. File structure

```
src/
  main.tsx
  App.tsx                      // owns `step` state, Song, LyricsData, CardOptions
  types.ts
  api/
    itunes.ts                  // search()
    lrclib.ts                  // fetchLyrics(), LRC parser
    artwork.ts                 // upscale + fetch-as-dataURL (shared by vibrant + export)
    vibrant.ts                 // extractPalette()
  components/
    SearchScreen/
      SearchScreen.tsx
      SearchScreen.css
    ResultCard/
      ResultCard.tsx
      ResultCard.css
    LyricsScreen/
      LyricsScreen.tsx
      LyricsScreen.css
    EditorScreen/
      EditorScreen.tsx
      EditorScreen.css
    LyricCard/                 // THE component being exported to an image — see §7
      LyricCard.tsx
      LyricCard.css
    ControlPanel/
      ControlPanel.tsx
      ControlPanel.css
  styles/
    tokens.css                 // CSS custom properties, imported once in main.tsx
    reset.css
  hooks/
    useLyricFontTier.ts        // §7.7
```

---

## 4. API layer

### 4.1 iTunes search — `api/itunes.ts`

```
GET https://itunes.apple.com/search?term={encodeURIComponent(query)}&entity=song&limit=12
```

- Trigger on `Enter` keydown in the search input — **not** on every keystroke.
  There is no debounce requirement because there's no live-as-you-type search.
- Map the response's `results[]` array to `Song[]`:

| iTunes field | → | Song field |
|---|---|---|
| `trackId` | | `trackId` |
| `trackName` | | `trackName` |
| `artistName` | | `artistName` |
| `collectionName` | | `collectionName` |
| `artworkUrl100` | | `artworkUrlSmall` |
| `artworkUrl100` (upscaled, §4.3) | | `artworkUrlLarge` |
| `trackTimeMillis` | | `durationMs` |

- If `trackTimeMillis` is missing on a result, skip that result entirely (it's
  usually a podcast episode misfiled as a song).
- Show a simple empty state ("No results for '{query}'") if `results.length === 0`.

### 4.2 Duration formatting (used in ResultCard and the editor)

```ts
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

### 4.3 Artwork upscaling — `api/artwork.ts`

iTunes artwork URLs encode their resolution in the filename, e.g.
`.../100x100bb.jpg`. Get a much higher-res version by string-replacing that
segment:

```ts
export function upscaleArtwork(url: string, size = 1200): string {
  return url.replace(/\d+x\d+bb\.(jpg|png)/, `${size}x${size}bb.$1`);
}
```

**Critical gotcha — do this or export will silently fail:**
Both `node-vibrant` and `html-to-image` read pixel data out of a `<canvas>`.
If an image is loaded cross-origin without proper handling, the canvas
becomes "tainted" and both operations throw/fail silently. Do not point
`background-image` or `<img src>` directly at the `mzstatic.com` URL. Instead,
fetch the image once, convert it to a base64 data URL, and use *that* data URL
everywhere (the `<img>` tag, the CSS background, and the `Vibrant.from(...)`
call):

```ts
export async function fetchArtworkAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

Call this once, when a song is selected (right before navigating to
`/lyrics`), store the resulting data URL in state alongside the `Song`
(e.g. `artworkDataUrl: string`), and thread it down to every place that
needs the image. Never re-fetch it.

### 4.4 LRCLib — `api/lrclib.ts`

```
GET https://lrclib.net/api/search?track_name={trackName}&artist_name={artistName}&album_name={collectionName}
```

- URL-encode each param. `album_name` is optional context that improves match
  quality — include it, but if the request returns nothing, retry once
  **without** `album_name` before giving up.
- The response is an array of candidate objects:
  ```json
  {
    "id": 151738,
    "trackName": "The Chain",
    "artistName": "Fleetwood Mac",
    "albumName": "Rumours",
    "duration": 271,
    "instrumental": false,
    "plainLyrics": "Listen to the wind blow\nWatch the sun rise...",
    "syncedLyrics": "[00:27.93] Listen to the wind blow\n[00:30.88] Watch the sun rise..."
  }
  ```
- Selection rule: take the **first** result in the array where
  `instrumental === false` and (`syncedLyrics` or `plainLyrics`) is a
  non-empty string. If no such result exists, show an empty state on the
  Lyrics screen ("No lyrics found for this track — go back and try another
  match") with a button that returns to Search.
- Prefer `syncedLyrics` over `plainLyrics` when both exist.

**Parsing `syncedLyrics` into `LyricLine[]`:**

```ts
const LRC_LINE = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

export function parseSyncedLyrics(raw: string): LyricLine[] {
  return raw
    .split('\n')
    .map((line) => line.match(LRC_LINE))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m, index) => {
      const [, mm, ss, cs, text] = m;
      const centiseconds = cs.length === 2 ? Number(cs) : Number(cs) / 10;
      const time = Number(mm) * 60 + Number(ss) + centiseconds / 100;
      return { index, time, text: text.trim(), selected: false };
    })
    .filter((l) => l.text.length > 0); // drop blank timing markers (intros/outros)
}
```

**Parsing `plainLyrics` (fallback, no timing):**

```ts
export function parsePlainLyrics(raw: string): LyricLine[] {
  return raw
    .split('\n')
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text, index) => ({ index, time: null, text, selected: false }));
}
```

Build the final `LyricsData` as:
```ts
{ lines, isTimeSynced: lines.every(l => l.time !== null) }
```

### 4.5 node-vibrant — `api/vibrant.ts`

```ts
import { Vibrant } from 'node-vibrant/browser';

export interface PaletteSwatch {
  name: 'Vibrant' | 'LightVibrant' | 'DarkVibrant' | 'Muted' | 'LightMuted' | 'DarkMuted';
  hex: string;
  textColor: string; // '#000000' or '#FFFFFF' — node-vibrant computes this for you
}

const SWATCH_PRIORITY = ['Vibrant', 'LightVibrant', 'Muted', 'DarkVibrant', 'DarkMuted', 'LightMuted'] as const;

export async function extractPalette(artworkDataUrl: string): Promise<PaletteSwatch[]> {
  const palette = await Vibrant.from(artworkDataUrl).getPalette();
  return SWATCH_PRIORITY
    .filter((name) => palette[name] != null)
    .map((name) => ({
      name,
      hex: palette[name]!.hex,
      textColor: palette[name]!.titleTextColor, // built-in contrast-safe color
    }));
}
```

Call this once when entering the Editor screen. Use `extractPalette(...)[0].hex`
as the initial `solidColor` (falling back to `#C2661D` — the reference image's
tone — if the array is empty, which can happen on a solid-color or corrupt
artwork image).

---

## 5. Screen 1 — Search (`SearchScreen`)

Layout: centered vertically and horizontally until a search has been run;
once results exist, the search bar sticks to the top and results fill the
space below.

- Search input: full-width up to `560px`, height `56px`, `border-radius: 16px`,
  background `var(--surface-2)`, border `1px solid var(--border)`, font-size
  `17px`, padding `0 20px`. Placeholder: "Search for a song…"
- On `Enter`, call the iTunes API and render a loading state (a simple
  3-dot pulse, no need for a full skeleton system) in place of the results.

**Results grid (`ResultCard` list):**

- `display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;`
- Max width of the whole results container: `960px`, centered (`margin: 0 auto`).

**`ResultCard`** — a clickable box:

```css
.result-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  cursor: pointer;
  text-align: left;
  transition: transform 120ms ease, border-color 120ms ease;
}
.result-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.result-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.result-card__art {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.result-card__meta { min-width: 0; } /* allow text-overflow to work in a flex child */
.result-card__title {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.result-card__subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.result-card__duration {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
```

Show `trackName` in `__title`, `"{artistName} · {collectionName}"` in
`__subtitle`, `formatDuration(durationMs)` in `__duration`, and
`artworkUrlSmall` (not the upscaled one — this is a 56px thumbnail, no need
for 1200px source) in `__art`.

On click: store the `Song`, call `fetchArtworkAsDataUrl(upscaleArtwork(...))`
(§4.3), then move to `step = 'lyrics'`.

---

## 6. Screen 2 — Lyrics picker (`LyricsScreen`)

On mount, call `fetchLyrics()` (§4.4). Show the loading pulse while waiting.

Layout: a narrow centered column, `max-width: 640px`. At the top, repeat the
chosen song's title/artist small (`14px`, muted) so the user has context.
Below it, the line list; below that, a sticky "Continue" button (disabled
until at least one line is selected).

```css
.lyric-line-option {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 17px;
  color: var(--text-secondary);
  transition: background 120ms ease, color 120ms ease;
}
.lyric-line-option:hover { background: var(--surface-2); }
.lyric-line-option--selected {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--text-primary);
  font-weight: 600;
}
.lyric-line-option__time {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  min-width: 38px;
}
```

- If `line.time !== null`, show it in `__time` as `m:ss` (reuse a small
  version of `formatDuration`, converting seconds → ms by `*1000` or just
  writing a `formatSeconds` twin). If `time === null`, render an empty
  `__time` span so the list still aligns.
- Clicking a line toggles its `selected` boolean (simple array map by
  `index`). No ordering logic needed — order of display always follows
  `line.index`, regardless of click order.
- No cap on how many lines can be selected, but put a small hint under the
  list: "Tip: 1–4 lines look best on the card."

"Continue" button navigates to `step = 'editor'` and triggers
`extractPalette()` (§4.5) in the background.

---

## 7. Screen 3 — Editor (`EditorScreen`) + the `LyricCard` component

This is the part that must be pixel-exact. Read this whole section before
writing any code — the pieces depend on each other.

### 7.1 Editor screen layout

Two-column layout on desktop (`≥ 960px`), stacked on mobile:

```css
.editor-screen {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
  align-items: start;
}
@media (max-width: 959px) {
  .editor-screen { grid-template-columns: 1fr; }
}
```

- Left column: the live card preview, centered in its space, with the
  Export buttons directly beneath it.
- Right column: `ControlPanel` (§8), `position: sticky; top: 32px;`.

### 7.2 The single most important architectural decision: render at true size, scale visually

The card must look and export identically regardless of what size it's
displayed at on screen. Do this by **always rendering the `LyricCard` DOM
node at its true export pixel dimensions** (e.g. `1280×800` for the
`classic` ratio — see §7.3 table), and only shrinking it visually for
on-screen display using a CSS `transform: scale()` on a wrapper. `transform`
does not change layout size, so:

- The card's own CSS (all in `cqw` units, see §7.4) always computes against
  its true width.
- `html-to-image` (§9) captures the *real* DOM node — not the scaled
  wrapper — so the exported file is always full resolution, never a
  scaled-down screenshot.

```tsx
// EditorScreen.tsx (sketch)
const PREVIEW_MAX_WIDTH = 480; // px, how big the preview area is on screen

function CardPreviewFrame({ trueWidth, trueHeight, children }) {
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / trueWidth);
  return (
    <div style={{ width: trueWidth * scale, height: trueHeight * scale, overflow: 'hidden' }}>
      <div style={{ width: trueWidth, height: trueHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children /* <LyricCard/> at its true 1280x800 (etc.) size, unaware it's being scaled */}
      </div>
    </div>
  );
}
```

Keep a `ref` on the *inner* (true-size, unscaled) `LyricCard` div — that's
the node you pass to `html-to-image`, never the scaled wrapper.

### 7.3 Aspect ratio presets

Store these as a lookup table. Widths/heights are the *true* export pixel
dimensions.

| key | label | width × height | notes |
|---|---|---|---|
| `classic` | Classic | `1280 × 800` | **default** — matches the reference image's proportions |
| `square` | Square | `1080 × 1080` | Instagram post |
| `portrait` | Portrait | `1080 × 1350` | Instagram portrait |
| `story` | Story | `1080 × 1920` | Stories / Reels |
| `widescreen` | Widescreen | `1920 × 1080` | landscape / social banner |

```ts
export const ASPECT_RATIOS: Record<AspectRatioKey, { label: string; width: number; height: number }> = {
  classic:    { label: 'Classic',    width: 1280, height: 800 },
  square:     { label: 'Square',     width: 1080, height: 1080 },
  portrait:   { label: 'Portrait',   width: 1080, height: 1350 },
  story:      { label: 'Story',      width: 1080, height: 1920 },
  widescreen: { label: 'Widescreen', width: 1920, height: 1080 },
};
```

### 7.4 Why everything scales in `cqw`, and how

All internal spacing/type in the card is defined using **CSS container query
units (`cqw`)** — `1cqw` = 1% of the nearest ancestor with
`container-type: inline-size`. This means every measurement is a percentage
of the card's own width, so the *exact same CSS* automatically looks right
on a `1080px` square card and a `1920px` widescreen card — no JavaScript
recalculation needed when the user switches aspect ratio.

Every `cqw` value below was derived from measuring the reference image
(assumed ≈`1280px` wide) as `(measured_px / 1280) * 100`, then rounded. Do
not re-derive these — use the numbers in the tables directly.

```css
.lyric-card {
  container-type: inline-size;
  container-name: card;
}
```

Wrap every font-size/spacing value in `clamp()` with generous px floor/ceiling
guards, purely as a safety net against unforeseen extreme sizes — the `cqw`
value is what actually drives normal behavior:

```css
font-size: clamp(20px, 4.1cqw, 110px);
```

### 7.5 `LyricCard` DOM structure

```html
<div class="lyric-card" data-bg-mode="blurred|solid" style="--card-w: 1280px; --card-h: 800px;">
  <!-- background layer, only meaningful in blurred mode -->
  <div class="lyric-card__bg">
    <div class="lyric-card__bg-image" style="background-image: url(artworkDataUrl)"></div>
    <div class="lyric-card__bg-overlay"></div>
  </div>

  <div class="lyric-card__content">
    <header class="lyric-card__header">
      <img class="lyric-card__artwork" src="artworkDataUrl" />
      <div class="lyric-card__meta">
        <p class="lyric-card__title">{trackName}</p>
        <p class="lyric-card__artist">{artistName}</p>
        <p class="lyric-card__album">{collectionName}</p>
      </div>
    </header>

    <div class="lyric-card__progress">
      <div class="lyric-card__progress-track">
        <div class="lyric-card__progress-fill" style="width: {progressPercent}%"></div>
      </div>
      <div class="lyric-card__progress-labels">
        <span>{currentTimeLabel}</span>
        <span>{formatDuration(durationMs)}</span>
      </div>
    </div>

    <div class="lyric-card__lyrics lyric-card__lyrics--{fontTier}">
      <p class="lyric-card__line">And it's not a dream anymore</p>
      <p class="lyric-card__line">No, it's not a dream anymore</p>
      <p class="lyric-card__line">It's worth fighting for</p>
    </div>
  </div>
</div>
```

Notes on this structure:
- `.lyric-card__artwork` is present in the DOM regardless of the
  `showArtwork` toggle; toggle it with `display: none` (not by removing the
  element) so the header's flex layout doesn't jump around while editing.
  Same pattern for `.lyric-card__artist`, `.lyric-card__album`,
  `.lyric-card__progress`.
- Only render `.lyric-card__line` elements for lines where `selected ===
  true`, in ascending `index` order.

### 7.6 Full CSS — `LyricCard.css`

```css
.lyric-card {
  position: relative;
  width: var(--card-w);
  height: var(--card-h);
  overflow: hidden;
  border-radius: 3.1cqw;
  container-type: inline-size;
  font-family: 'Poppins', 'Segoe UI', sans-serif;
}

/* ---------- BACKGROUND: solid mode ---------- */
.lyric-card[data-bg-mode="solid"] {
  background-color: var(--solid-color, #C2661D);
}
.lyric-card[data-bg-mode="solid"] .lyric-card__bg { display: none; }

/* ---------- BACKGROUND: blurred mode ---------- */
.lyric-card[data-bg-mode="blurred"] .lyric-card__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.lyric-card__bg-image {
  position: absolute;
  inset: -20%; /* oversize past the edges so the blur has no bare edge to reveal */
  background-size: cover;
  background-position: center;
  transform: scale(1.35);
  filter: blur(70px) saturate(1.6) brightness(0.55);
}
.lyric-card__bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55));
}

/* ---------- CONTENT WRAPPER ---------- */
.lyric-card__content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center; /* vertically centers the whole content block —
                               matters most on tall ratios like `story` */
  padding: 5cqw;
  box-sizing: border-box;
}

/* ---------- HEADER ---------- */
.lyric-card__header {
  display: flex;
  align-items: flex-start;
  gap: 2.5cqw;
}
.lyric-card__artwork {
  width: 11.7cqw;
  height: 11.7cqw;
  border-radius: 1.6cqw;
  object-fit: cover;
  flex-shrink: 0;
}
.lyric-card__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.lyric-card__title {
  margin: 0 0 0.5cqw 0;
  font-size: clamp(20px, 4.1cqw, 110px);
  font-weight: 800;
  line-height: 1.1;
  color: var(--card-text-color);
}
.lyric-card__artist {
  margin: 0 0 0.4cqw 0;
  font-size: clamp(12px, 2.3cqw, 62px);
  font-weight: 700;
  line-height: 1.2;
  color: var(--card-text-color);
  opacity: 0.68;
}
.lyric-card__album {
  margin: 0;
  font-size: clamp(10px, 1.7cqw, 46px);
  font-weight: 600;
  line-height: 1.2;
  color: var(--card-text-color);
  opacity: 0.5;
}

/* ---------- PROGRESS BAR ---------- */
.lyric-card__progress {
  margin-top: 3.5cqw;
}
.lyric-card__progress-track {
  width: 100%;
  height: 0.6cqw;
  min-height: 3px;
  border-radius: 999px;
  background: var(--progress-track-color);
  overflow: hidden;
}
.lyric-card__progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--progress-fill-color);
}
.lyric-card__progress-labels {
  margin-top: 0.8cqw;
  display: flex;
  justify-content: space-between;
  font-size: clamp(9px, 1.4cqw, 32px);
  font-weight: 600;
  color: var(--card-text-color);
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

/* ---------- LYRICS ---------- */
.lyric-card__lyrics {
  margin-top: 5cqw;
  display: flex;
  flex-direction: column;
  gap: 1cqw;
}
.lyric-card__line {
  margin: 0;
  font-weight: 800;
  line-height: 1.15;
  color: var(--card-text-color);
}
.lyric-card__lyrics--large .lyric-card__line  { font-size: clamp(22px, 4.5cqw, 130px); }
.lyric-card__lyrics--medium .lyric-card__line { font-size: clamp(18px, 3.5cqw, 100px); }
.lyric-card__lyrics--small .lyric-card__line  { font-size: clamp(14px, 2.7cqw, 78px); }

/* ---------- TEXT GLOW, blurred mode only ---------- */
.lyric-card[data-bg-mode="blurred"] .lyric-card__title,
.lyric-card[data-bg-mode="blurred"] .lyric-card__artist,
.lyric-card[data-bg-mode="blurred"] .lyric-card__album,
.lyric-card[data-bg-mode="blurred"] .lyric-card__line,
.lyric-card[data-bg-mode="blurred"] .lyric-card__progress-labels {
  text-shadow: 0 0 18px rgba(255,255,255,0.30), 0 2px 10px rgba(0,0,0,0.45);
}
```

**Why the "glow" only appears in blurred mode:** in solid mode the
background is a single flat color and `--card-text-color` is already chosen
for full contrast against it (§7.8), so a glow would just look muddy. In
blurred mode the background has texture and varying brightness, so a soft
white glow + dark drop-shadow keeps the (always-white) text readable
everywhere on the image, exactly like Apple Music's lyrics view.

### 7.7 Choosing the lyrics font-size tier (`useLyricFontTier.ts`)

Selected lines can vary a lot in total length. Rather than measuring
rendered height with JS (fragile, causes layout thrashing), pick a class
from total character count of the *selected* lines joined together:

```ts
export function useLyricFontTier(selectedLines: LyricLine[]): 'large' | 'medium' | 'small' {
  const totalChars = selectedLines.reduce((sum, l) => sum + l.text.length, 0);
  if (totalChars <= 90) return 'large';
  if (totalChars <= 180) return 'medium';
  return 'small';
}
```

Apply the returned value as the modifier class on `.lyric-card__lyrics`
(§7.5/§7.6).

### 7.8 Text color logic

**Blurred mode:** always `--card-text-color: #F5F5F5` (near-white). Fixed,
never computed — the darkening overlay (§7.6) guarantees enough contrast
against any artwork.

**Solid mode:** the text color depends on how light or dark the chosen
background is.

- If the color came from a `node-vibrant` swatch, use that swatch's
  `.titleTextColor` directly (§4.5 already returns this as `textColor` —
  it's a contrast-safe `#000000` or `#FFFFFF` computed by the library).
- If the color came from the **custom color picker** (§8.4 — an arbitrary
  user-chosen hex with no associated Swatch object), compute it yourself
  with this formula and threshold:

```ts
export function textColorForBackground(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return brightness > 0.6 ? '#141414' : '#FAFAFA';
}
```

Set the result as `--card-text-color` on the `.lyric-card` element's inline
style whenever `solidColor` changes.

### 7.9 Progress bar color variables

```css
/* solid mode */
--progress-track-color: color-mix(in srgb, var(--card-text-color) 20%, transparent);
--progress-fill-color: var(--card-text-color);

/* blurred mode (override) */
.lyric-card[data-bg-mode="blurred"] {
  --progress-track-color: rgba(255,255,255,0.25);
  --progress-fill-color: rgba(255,255,255,0.9);
}
```

### 7.10 Computing progress position

```ts
function computeProgress(song: Song, lines: LyricLine[], isTimeSynced: boolean) {
  const selected = lines.filter(l => l.selected).sort((a, b) => a.index - b.index);
  const anchor = selected[0]; // use the earliest selected line as "now playing"
  if (!anchor) return { percent: 0, currentTimeLabel: '' };

  if (isTimeSynced && anchor.time !== null) {
    const percent = Math.min(100, (anchor.time / (song.durationMs / 1000)) * 100);
    return { percent, currentTimeLabel: formatDuration(anchor.time * 1000) };
  }

  // not time-synced: fall back to an estimated position by line index.
  // Deliberately show NO numeric current-time label here — we don't have
  // a real timestamp, and a fabricated mm:ss would misrepresent the data.
  const totalLines = lines.length;
  const percent = totalLines > 1 ? (anchor.index / (totalLines - 1)) * 100 : 0;
  return { percent, currentTimeLabel: '' };
}
```

Feed `percent` into `.lyric-card__progress-fill`'s inline `width` style, and
`currentTimeLabel` into the left `.lyric-card__progress-labels` span (right
span is always `formatDuration(song.durationMs)`).

---

## 8. `ControlPanel` (right column of the editor)

A single scrollable column of grouped controls, `width: 340px`. Each group is
a `<section>` with a small uppercase label (`12px`, `letter-spacing: 0.04em`,
`color: var(--text-muted)`) followed by its control(s).

```css
.control-group { margin-bottom: 24px; }
.control-group__label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 10px;
}
```

### 8.1 Toggle switches (Artist, Album, Artwork, Progress bar)

Each is a labeled row with a switch on the right:

```css
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
}
.toggle-row__label { font-size: 14px; color: var(--text-primary); }
.switch {
  width: 40px; height: 24px;
  border-radius: 999px;
  background: var(--border);
  position: relative;
  cursor: pointer;
  transition: background 150ms ease;
}
.switch[data-on="true"] { background: var(--accent); }
.switch__knob {
  position: absolute; top: 2px; left: 2px;
  width: 20px; height: 20px;
  border-radius: 999px;
  background: #fff;
  transition: transform 150ms ease;
}
.switch[data-on="true"] .switch__knob { transform: translateX(16px); }
```

Four rows: "Artist name" → `showArtist`, "Album name" → `showAlbum`, "Album
cover" → `showArtwork`, "Progress bar" → `showProgressBar`.

### 8.2 Background mode

A two-option segmented control, not a switch (clearer that it's a mode, not
a boolean flag):

```css
.segmented {
  display: flex;
  padding: 3px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.segmented__option {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}
.segmented__option[data-active="true"] {
  background: var(--surface-1);
  color: var(--text-primary);
}
```

Options: "Blurred" (`backgroundMode = 'blurred'`) and "Solid"
(`backgroundMode = 'solid'`).

### 8.3 Color picker (only visible when `backgroundMode === 'solid'`)

Render the palette swatches from §4.5 as a row of circles, plus one more
circle that opens a native color input for a fully custom color:

```css
.palette-row { display: flex; gap: 10px; flex-wrap: wrap; }
.palette-swatch {
  width: 32px; height: 32px;
  border-radius: 999px;
  cursor: pointer;
  border: 2px solid transparent;
}
.palette-swatch[data-selected="true"] {
  border-color: var(--text-primary);
}
.palette-swatch--custom {
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-2);
  border: 1px dashed var(--border);
  font-size: 14px;
  color: var(--text-secondary);
}
```

The custom swatch is a `<label>` wrapping a hidden `<input type="color" />`
— clicking it opens the OS color picker; on `change`, set `solidColor` to
`e.target.value` and recompute `--card-text-color` via §7.8's formula
(since a manually-picked color has no Vibrant swatch object).

### 8.4 Aspect ratio

Same `.segmented` pattern as §8.2 but with 5 options (or, if that's visually
tight at `340px`, a 2-row wrap — `flex-wrap: wrap` handles it, each option
`min-width: 90px`), one per `ASPECT_RATIOS` key (§7.3), labeled with their
`label` field.

---

## 9. Export — `html-to-image`

```ts
import { toPng, toJpeg } from 'html-to-image';

async function exportCard(node: HTMLElement, format: 'png' | 'jpg') {
  const options = { cacheBust: true, pixelRatio: 1 };
  // pixelRatio stays 1 because the node is already rendered at its true
  // export resolution (§7.2) — don't multiply it again here.
  const dataUrl = format === 'png'
    ? await toPng(node, options)
    : await toJpeg(node, { ...options, quality: 0.95, backgroundColor: '#000000' });
    // backgroundColor is a JPEG-only fallback for any transparent pixel;
    // the card itself is always fully opaque so it won't actually show.

  const link = document.createElement('a');
  link.download = `lyric-card.${format}`;
  link.href = dataUrl;
  link.click();
}
```

Two buttons under the preview, "Download PNG" and "Download JPG", each
calling `exportCard(cardRef.current, 'png' | 'jpg')`. Since the artwork was
already fetched as a data URL back in §4.3 and used everywhere since, this
call needs no further CORS handling.

```css
.export-buttons { display: flex; gap: 12px; margin-top: 20px; justify-content: center; }
.export-button {
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
}
.export-button--primary { background: var(--accent); color: #14100B; }
.export-button--secondary { background: var(--surface-2); color: var(--text-primary); border: 1px solid var(--border); }
```

---

## 10. Site chrome — design tokens (`styles/tokens.css`)

The lyric card itself carries all the color and warmth (it's driven by
album art), so the surrounding app is deliberately quiet and dark — a
"studio at night" backdrop that lets the card be the only bright thing on
screen. One warm accent color (echoing the reference card's amber tone)
marks anything interactive; everything else is neutral ink and off-white.

```css
:root {
  --bg: #0E0E12;
  --surface-1: #17171D;
  --surface-2: #1D1D24;
  --border: #2A2A33;
  --text-primary: #F2F1ED;
  --text-secondary: #9C9AA6;
  --text-muted: #6E6C78;
  --accent: #FF8A3D;
}

body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: 'Inter', 'Segoe UI', sans-serif;
}
```

Load two Google Fonts in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **Poppins** (600/700/800) — used only inside `LyricCard` (title/artist/
  album/lyrics) and page-level headings. It's a rounded, geometric bold
  sans that matches the reference image's lettering.
- **Inter** — everything else (search input, buttons, labels, body text).

Base spacing scale used throughout the site chrome (not the card, which
uses `cqw` — see §7.4): `4px, 8px, 12px, 16px, 24px, 32px, 48px`. Corner
radii: `10px` small controls, `14–16px` cards/panels — deliberately smaller
and tighter than the lyric card's own `3.1cqw` (~40px at 1280 width) corner
radius, so the card visually reads as an distinct "object" sitting on top
of the app rather than blending into it.

---

## 11. Edge cases and gotchas checklist

- **iTunes result missing artwork** — `artworkUrl100` is occasionally
  absent. Fall back to a plain gray placeholder square in `ResultCard` and
  set `showArtwork` to `false` by default for that song in `CardOptions`
  (can't blur-background or extract a palette from nothing).
- **LRCLib has no match at all** — see §4.4's empty state.
- **Song has only `plainLyrics`, no `syncedLyrics`** — `isTimeSynced` is
  `false`; the progress bar still works via the index-based fallback in
  §7.10, but with no numeric current-time label.
- **User toggles `showProgressBar` off** — just `display: none` the
  `.lyric-card__progress` block; nothing else shifts because
  `.lyric-card__content` is a normal flex column (margin-top on the next
  element does not collapse against a hidden sibling incorrectly here,
  since `display:none` removes it from flow entirely — confirm this
  visually once built).
- **Very long lyric lines on narrow ratios** (`portrait`, `story`) — the
  `small` font tier (§7.7) plus the fact that font-size scales with a
  *narrower* `cqw` base on these ratios keeps this in check; no additional
  truncation logic is required.
- **`node-vibrant` returns a very light or very dark palette with no
  mid-tones** — the `SWATCH_PRIORITY` fallback chain in §4.5 already
  handles missing swatches; if literally all six are `null` (monochrome
  artwork), fall back to `#C2661D`.
- **Re-fetching artwork** — never call `fetchArtworkAsDataUrl` more than
  once per song. Store the result in the top-level `App.tsx` state next to
  `Song` and pass it down as a prop everywhere (ResultCard's own thumbnail
  can keep using the plain `artworkUrlSmall` URL, since that one is never
  exported and never fed into `node-vibrant`).

---

## 12. Build order (do it in this sequence)

1. `types.ts`, `styles/tokens.css`, `styles/reset.css` — nothing to look at
   yet, but everything else imports these.
2. `api/itunes.ts` + `SearchScreen` + `ResultCard` — get search working
   end-to-end, log the selected `Song` to console for now.
3. `api/artwork.ts` — wire up the data-URL fetch on song selection.
4. `api/lrclib.ts` + `LyricsScreen` — get lyric lines rendering and
   selectable, log the final `LyricLine[]` to console.
5. `LyricCard` component with **only** solid-mode CSS (§7.6 minus the
   `[data-bg-mode="blurred"]` rules) and a hardcoded solid color, no
   controls yet — get the static layout matching the reference image at
   the `classic` aspect ratio.
6. Add the blurred-mode CSS and the segmented toggle to switch modes.
7. `api/vibrant.ts` + the palette swatch row + custom color picker (§8.3).
8. Remaining `ControlPanel` toggles (§8.1) and aspect ratio switch (§8.4) —
   confirm the `cqw` system holds up by switching through all 5 ratios.
9. Progress bar logic (§7.10) wired to real `Song`/`LyricLine` data.
10. Export buttons (§9) — test both PNG and JPG on a song whose artwork
    came from a real network fetch, not a local test image, to catch any
    remaining CORS issue.
