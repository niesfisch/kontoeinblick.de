# Kontoeinblick

A privacy-first personal finance dashboard for German bank CSV exports.
Supports **DKB**, **ING-DiBa**, and **Sparkasse**.

→ [kontoeinblick.de](https://kontoeinblick.de)

## Features

- **Multi-bank CSV parsing** — DKB, ING-DiBa, Sparkasse auto-detected
- **100% local** — All processing in the browser. No data sent anywhere, no server, no tracking
- **KPI cards** — Total income/expenses, net cash flow, balance, transaction count, savings rate
- **Monthly chart** — Income vs. expenses per month (bar or stacked-by-group view)
- **Cumulative cash flow** — Running balance over the selected period
- **Top merchants** — Horizontal bar chart of biggest spending destinations
- **Largest transactions** — Top 5 income and expense transactions by amount
- **Transaction table** — Searchable, filterable, sortable, paginated
- **Group-based categorization** — Create custom rules (contains, starts with, regex) to group transactions; color-coded
- **Time range filters** — All / current month / previous month / current year / previous year / 3M / 6M / 12M / by year / by month / custom date range
- **Multi-select filters** — Filter by month and group simultaneously
- **Moving average overlay** — SMA toggle on daily filter chart and monthly chart (configurable period)
- **CSV export** — Export filtered transactions as semicolon-delimited CSV
- **PDF export** — Select sections, print or save as PDF via browser dialog
- **Collapsible cards** — Collapse/expand dashboard cards; state persisted in localStorage
- **DE/EN i18n** — Language toggle; persisted in localStorage
- **CSV merge** — Combine multiple CSV files from the same bank (different time periods) with deduplication; download merged file or use directly in dashboard
- **Keyboard shortcuts** — `Ctrl+F` → focus search, `←`/`→` → pagination, `Escape` → blur search
- **Mobile warning** — Dismissible overlay on small screens

## Usage

1. Open `index.html` in any modern browser (or open `dist/index.html` for the single-file build)
2. Download your CSV export from online banking:
   - **DKB**: Konto → Umsätze → Export → CSV
   - **ING**: Konto → Umsätze → Export als CSV
   - **Sparkasse**: Umsätze → CSV-Export
3. Drop the file onto the upload zone
4. (Optional) Load a groups JSON to restore previously created categories

No build step needed for development — just open and use.

## Build & Deploy

```bash
# Install dependencies (zero runtime deps, only esbuild for build)
npm install

# Build single-file dist
npm run build          # produces dist/index.html, dist/impressum.html, dist/datenschutz.html

# Build + upload in one step
npm run all            # runs build then upload

# Deploy to production
# Create ~/.env with: FTP_SERVER, FTP_USER, FTP_PASSWORD
npm run upload
```

The upload script copies these files to your FTP server: (`FTP_SERVER`, `FTP_USER`, `FTP_PASSWORD` from `~/.env`)

| File | Purpose |
|------|---------|
| `dist/index.html` | Main app (all inlined) |
| `dist/impressum.html` | Legal notice (all inlined) |
| `dist/datenschutz.html` | Privacy policy (all inlined) |
| `favicon.svg` | Browser tab icon |
| `sample_dkb.csv` | Demo data for "Load example" button |
| `sample_groups_dkb.json` | Demo groups for "Load example groups" button |
| `robots.txt` | SEO |
| `sitemap.xml` | SEO |

## Build (single-file distribution)

```bash
npm install
npm run build
```

Produces `dist/index.html` — a single self-contained file with all JS and CSS inlined and minified.

## Project Structure

```
├── index.html             # Main app page
├── style.css              # All styles
├── app.js                 # Dashboard logic, charts, merge (ES module)
├── i18n.js                # DE/EN translations
├── groups.js              # Group/rule engine
├── parser.js              # Multi-bank CSV parser entry point
├── parser-dkb.js          # DKB parser
├── parser-ing.js          # ING-DiBa parser
├── parser-sparkasse.js    # Sparkasse parser
├── parser-utils.js        # Shared parsing utilities + dedupKey
├── build.mjs              # Build script (esbuild bundler)
├── impressum.html         # Legal notice
├── datenschutz.html       # Privacy policy
├── legal.js               # Language toggle for legal pages
├── robots.txt / sitemap.xml
├── sample_dkb.csv         # Demo data
└── tests/
    ├── parser.test.mjs    # 86 parser unit tests
    ├── merge.test.mjs     # 15 merge/parser-utils tests
    └── fixtures/          # Test fixtures (DKB, ING, Sparkasse)
```

## Groups

Groups and their rules are stored **only in localStorage** and are **not persisted** across sessions. Export your groups as JSON (via the dashboard toolbar) and save the file. On next visit, upload the JSON on the start screen or import it via the dashboard.

## Browser Compatibility

Chrome, Firefox, Safari, Edge — requires ES modules support.

## Privacy

No analytics, no cookies, no external requests except Chart.js (loaded from jsDelivr CDN — you can self-host it). Your financial data never leaves your device.

## License

MIT — see [LICENSE](LICENSE)

# For me

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/niesfisch' git pull  
GIT_SSH_COMMAND='ssh -i ~/.ssh/niesfisch' git push origin main
```

