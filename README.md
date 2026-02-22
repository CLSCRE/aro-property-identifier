# CLS CRE — LA Adaptive Reuse Property Identifier

Professional commercial real estate prospecting tool for identifying and analyzing properties eligible for adaptive reuse conversion under the Los Angeles Citywide Adaptive Reuse Ordinance (ARO), effective February 1, 2026.

Built by CLS CRE — a commercial mortgage brokerage in Los Angeles.

## How to Run

### Tab 1 — Single Property Screener
Open `index.html` directly in Chrome. No server required. All scoring and analysis runs client-side.

### Tab 2 — Map Heat Map Screener
The map tab requires a local server due to API cross-origin restrictions.

**Option A: run.bat (Windows)**
```
Double-click run.bat
```
This starts a local server via `npx serve` on port 3000.

**Option B: Manual**
```bash
npx serve . --port 3000
# or
python -m http.server 3000
# or
php -S localhost:3000
```

Then open `http://localhost:3000` in your browser.

## Features

### Single Property Screener
- Full ARO eligibility determination (by-right, conditional, ineligible)
- Opportunity scoring engine (0–100 scale) with 7 weighted factors
- Dynamic broker deal angles based on property characteristics
- Financing pathway recommendations (construction bridge, debt fund, SBA 504, HUD 221(d)(4), HTC equity, CMBS)
- Measure ULA transfer tax warnings for transactions >$5M
- Exportable deal summary (.txt download)

### Map Heat Map Screener
- Interactive Leaflet map of all ARO-eligible parcels in LA
- Color-coded markers by eligibility status and opportunity score
- Filter sidebar: property type, building age, size, eligibility, score
- Click-to-detail panel with quick deal angles and financing notes
- Scrollable property list sorted by score
- "Run Full Analysis" pre-populates Single Screener form

### Prospecting List
- Save properties from the map to a session-based list
- Export saved properties as CSV
- Score badges and eligibility chips for quick scanning

## API Documentation

### LA County Assessor (Socrata Open Data)
- **Endpoint**: `https://data.lacounty.gov/resource/9trm-uz8i.json`
- **Query**: SoQL with `$where` clause for bounding box via `within_box(location, south, west, north, east)`
- **Fields**: `ain`, `situsaddress`, `usedescription`, `effectiveyearbuilt`, `sqftmain`, `location`
- **Auth**: No API key required for public access. Optional `$$app_token` for higher rate limits.
- **Limits**: 1,000 rows per request default; app queries 500 max.

### Fallback
- **Endpoint**: `https://assessorapi.lacounty.gov/api/Parcel`
- Used if Socrata endpoint has CORS issues.

### ZIMAS (LA City Planning)
- **Endpoint**: `https://zimas.lacity.org/Documents/ArcGISProxy/LandUseProxy.aspx`
- **Query**: `?lat={lat}&lng={lng}`
- Returns zoning designation for a given coordinate.

## How to Extend

### Adding CoStar CSV Import
1. Add a file input to the map sidebar or create a new tab
2. Parse CSV rows with Papa Parse or native FileReader
3. For each row, call `AROScoring.calculateScore()` with mapped fields
4. Render results in a batch table with export option

### Adding New Scoring Factors
1. Edit `js/aro-scoring.js` → `calculateScore()` function
2. Add new factor logic with points allocation
3. Add factor to the `factors` array with label, value, note, and sentiment
4. Update total score cap if needed (currently 100)

## Known Limitations

- **API Rate Limits**: Socrata public access has throttling (~1,000 requests/hour without app token). Register for a free app token at data.lacounty.gov for higher limits.
- **CORS on file://**: Tab 2 (Map) requires a local server because browser CORS policies block API calls from `file://` protocol. Tab 1 works without a server.
- **Data Freshness**: LA County Assessor data is updated quarterly. Year built, use codes, and square footage may be 3–6 months behind.
- **Sample Data Fallback**: If the Socrata API is unavailable or returns CORS errors, the map will display sample/mock parcels for demonstration purposes.
- **Zoning Data**: ZIMAS API may have intermittent availability. Zoning lookups fail gracefully.

## Phase 2 Roadmap

- [ ] CoStar CSV batch import — upload property lists for bulk ARO scoring
- [ ] Owner contact enrichment — integrate property owner names and mailing addresses
- [ ] Salesforce push — export prospecting list directly to CRM pipeline
- [ ] Neighborhood boundary overlays — show ARO zones and community plan areas on map
- [ ] Transaction history — recent sales data to inform acquisition basis analysis

## Tech Stack

- Vanilla HTML/CSS/JavaScript — no frameworks, no build tools
- Leaflet.js v1.9.4 for interactive mapping
- Leaflet.markercluster for performance at low zoom levels
- OpenStreetMap tiles (free, no API key)
- LA County Assessor Socrata API (public, free)
- ZIMAS LA City Planning API (public, free)

---

**CLS CRE** | [clscre.com](https://clscre.com) | [clscre.ai](https://clscre.ai)
