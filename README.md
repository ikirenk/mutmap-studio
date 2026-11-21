# MutMap Studio

**MutMap Studio** is a standalone desktop bioinformatics application (**Electron + React + TypeScript + D3.js / Pure SVG**) that converts raw, copy-pasted mutation tables from scientific papers into structured JSON using AI and renders publication-ready vector visualizations.

---

## Key Features

### 1. AI-Powered Mutation Table Parser
- **Messy PDF / Paper Copy-Paste Support:** Automatically detects table headers, merges wrapped continuation lines, splits large tables into overlapping chunks to stay within token limits, and deduplicates boundary entries.
- **Multiple AI Providers:**
  - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`) with strict `responseSchema`
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, `gpt-5-mini`) + **Custom OpenAI-Compatible Endpoint URL** support (e.g., `https://api.axforge.ai/v1/chat/completions`, local `http://localhost` servers)
  - **OpenRouter** (`anthropic/claude-3.5-sonnet`, `google/gemini-2.5-flash`, `openai/gpt-4o`, `deepseek/deepseek-chat`)
- **Offline Fallback:** Built-in deterministic CSV/TSV/space-delimited parser for quick parsing without an API key.
- **Structured Extraction:** Parses `cDNA_change`, `protein_change`, `position_aa`, `position_bp`, `exon`, `mutation_type`, `phenotype_or_type`, and splits combined counts like `"30(58)"` into separate `family_count` and `allele_count` fields.
- **Editable Data Grid:** Inline editing, sorting, search, validation warnings, and CSV/JSON import & export before plotting.

### 2. Gene & Protein Structure Definition
- Manually define protein length (`aa`), cDNA length (`bp`), protein domains, and exons, or import them from JSON/CSV.
- **One-Click Auto-Fetch:** Query **UniProt** (protein length & structural domains) and **Ensembl** (canonical transcript coding exons) directly by gene symbol (e.g. `ITGB2`, `NFKB1`, `TP53`).

### 3. Two Publication-Grade Pure SVG Visualization Modes
- **Mode 1 — Protein Domain & Detailed Mutation Map:**
  - Horizontal N-to-C protein bar with color-coded domains and amino acid ruler.
  - Top/bottom splitting by phenotype, mutation type, alternating, or top-only.
  - Multi-tier horizontal collision avoidance and 45°/90° angled label layouts with 3-segment vector leader lines.
- **Mode 2 — cDNA / Exon Frequency Map (Lollipop & Expanding Pyramid Clusters):**
  - Proportional exon track with optional protein domain bars mapped below.
  - Stacks symbols by family count or allele count; automatically transitions high-frequency hotspots above a configurable threshold into compact 2/3/4+-column expanding pyramids.
  - Non-overlapping horizontal cluster placement with non-crossing angled bottom stems pointing to exact bp coordinates.
  - **Direct-above-cluster** (arrow-free) or **leader-line** label modes with independent font family, size, weight, color, angle, and content toggles.

### 4. Interactive Studio & Export
- **Drag & Drop + Undo/Redo:** Drag both mutation labels and Mode 2 symbol clusters directly on the SVG canvas (`Ctrl+Z` / `Ctrl+Shift+Z`).
- **Live Styling & Filtering:** Academic presets (*Nature / Science*, *NEJM / Blood*, *Grayscale Print*), custom colors/shapes/sizes per mutation type, typography controls, legend placement, and filtering by mutation type, phenotype, minimum count, or position range.
- **Publication Exports:**
  - **SVG** (clean pure vector XML editable in Adobe Illustrator & Inkscape)
  - **PDF** (true vector PDF via Electron `printToPDF`)
  - **PNG** (**300 DPI** & **600 DPI** with embedded `pHYs` physical DPI headers)
- **Project Persistence:** Save and reopen complete projects (data + manual positions + styles + filters) as `.json` files (API keys are encrypted locally via Electron `safeStorage` and never written to project files).

---

## Tech Stack

- **Desktop & Build:** Electron 33, Vite 6, TypeScript 5, `electron-builder`
- **UI & State:** React 18, Zustand, Tailwind CSS, Lucide Icons
- **Visualization & Validation:** D3.js (`scaleLinear`, color contrast), Pure SVG, Zod
- **PDF & Raster Export:** Electron `printToPDF`, `jsPDF` + `svg2pdf.js`, HTML5 Canvas + PNG `pHYs` encoder
- **Testing:** Vitest

---

## Development & Build

### Prerequisites
- Node.js `>= 20`
- npm

### Commands

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Start desktop app in development mode (Vite HMR + Electron)
npm run dev

# Type-check & build production bundle
npm run build

# Launch production Electron app locally
npm run start:electron

# Build standalone installer / executable for current OS (outputs to release/)
npm run package

# Build Windows NSIS installer
npm run package:win
```

---

## Automated GitHub Releases

This repository includes [`.github/workflows/release.yml`](.github/workflows/release.yml) to automatically build and upload desktop executables for **Linux** (`.AppImage`, `.deb`), **Windows** (`.exe`), and **macOS** (`.dmg`) whenever a version tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Author

**Batuhan Aydogan** — [github.com/ikirenk](https://github.com/ikirenk)
