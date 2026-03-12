# NVDB Finn Vegdata - Specification

## Overview

A static web application for visualizing road objects (vegobjekter) from the Norwegian Public Roads Administration's database (NVDB) on an interactive map of Norway. The app visualizes road segments (veglenker) and shows which road objects are located on each segment.

The map uses EPSG:25833 (UTM33) and switches between Geodata.no XYZ tiles for overview levels and Kartverket topo WMTS tiles for detailed views. The Kartverket tiles use a BAAT token fetched from `https://nvdb-baat-dispenser.atlas.vegvesen.no/api/v1/token`.

The application is in **beta** and displays a visible beta badge in the header.

Feature-specific behavior should be documented in this specification. Keep `AGENTS.md` focused on general workflow and guardrail rules.

## Core Workflow

1. **Select Object Types** - User selects which road object types they want to find
2. **Choose Search Mode** - Toggle between polygon, vegsystemreferanse (strekning), or stedfesting (switching mode clears other search inputs/state)
3. **(Optional) Set Date Filter** - Use the "Bruk dato" checkbox and date input in the top row next to mode buttons. Date changes are applied on blur/Enter.
4. **Define Area/Route** - Draw a small polygon or paste a polygon WKT and click "Søk"/"Kopier WKT", enter a vegsystemreferanse (e.g., "FV6666 S1"), or provide stedfesting (e.g., "0.2-0.5@1234")
5. **Fetch Veglenker** - Query veglenkesekvenser by polygon, vegsystemreferanse, or stedfesting IDs (configurable limit, default 500, max 1000)
6. **Visualize Veglenker** - Display veglenker on map (only those with geometry overlapping polygon). Polygon clipping is enabled by default, fading the full veglenke and overlaying only the portion inside the polygon.
7. **Fetch Vegobjekter** - In polygon mode, strekning mode, and stedfesting mode, fetch vegobjekter for all selected types directly from `GET /api/v1/vegobjekter/stream` using the drawn polygon, vegsystemreferanse, or stedfesting filter and parse the NDJSON response incrementally. While the stream is active, the UI shows how many vegobjekter have been fetched so far. If the stream reaches the request limit of 10,000 objects, show a warning suggesting a smaller area, narrower strekning, or fewer/smaller stedfestinger to fetch all results. If the stream times out after some vegobjekter have already arrived, keep the partial results and show a warning that the result set is incomplete. `dato` is always sent in the vegobjekt query (selected date when enabled, otherwise today's date).
8. **Inspect** - View detailed vegobjekt information in a collapsible list

## Key Concepts

### Veglenkesekvenser (Road Link Sequences)
- The road network is divided into veglenkesekvenser
- Each veglenkesekvens contains one or more veglenker (road links)
- Veglenker have geometry (WKT) that can be visualized
- Veglenker have a position range (0.0 to 1.0) along the sequence

### Stedfesting (Location Reference)
- Vegobjekter are located on the road network via stedfesting
- Stedfesting references a veglenkesekvens ID and position(s)
- For lines: startposisjon and sluttposisjon (format: "0.2-0.8@1234")
- For points: single posisjon (format: "0.5@1234")
- Overlap detection: check if object's position range intersects veglenke's position range

### Polygon Clipping (Default)
- Enabled by default in polygon mode (can be toggled off)
- The app calculates the intersection between each veglenke geometry and the polygon
- Veglenker fully outside the polygon are filtered out
- The stedfesting filter is based on the overlapping geometry only (not the full veglenke extent)
- The map renders the full veglenke in a faded style with the clipped portion emphasized

### Date Filtering
- Date filter is controlled by a checkbox + date input in the top row (next to search mode controls)
- Date input changes are applied on blur (or Enter), not on every keystroke
- Vegobjekt queries always include `dato` (selected date when enabled, otherwise today's date)
- Veglenker are filtered client-side against `gyldighetsperiode` using:
  - `startdato` inclusive
  - `sluttdato` exclusive

### Map Styling
- Veglenke line color can be changed at runtime via the "Innstillinger" menu in the map
- Colors are persisted in localStorage
- A metric scale bar is shown in the lower-left corner of the map
- A debug console API is available on `window.nvdbMap` (e.g. `nvdbMap.setVeglenkeColor('#00ff00')`, `nvdbMap.getVeglenkeColor()`)

### Measuring Tool
- A ruler button in the top-right map toolbar activates the measure tool
- Click on the map to place points; each segment shows its length at the midpoint (when multi-segment)
- The total cumulative distance is shown at the last point (red badge)
- Double-click to finish a measurement; the labels remain on the map
- Click the ruler button again (or start a new measurement) to clear the previous measurement
- Distances are computed in UTM33 (meters); values >= 1 km are shown in km with 2 decimal places

## UI Design System

The UI uses a small set of global CSS tokens (in `src/index.css` under `:root`) to keep spacing, borders, radii and shadows consistent.

### Tokens
- Prefer existing `--ui-*` tokens over hard-coded values when the style is meant to match existing UI
- Add a new token only when a value is reused or represents a real semantic choice (e.g. surface, border, radius)

### Reusable Building Blocks
- Use `.btn` for primary/secondary/danger actions
- Use `.btn-icon` for square icon-only actions (same focus ring as `.btn`)
- Use `.ui-surface` for white panels with border + radius
- Use `.ui-popover` for popovers (surface + border + radius + shadow)

### Avoiding Accidental Duplication
- When adding UI, first search for an existing class/token that matches what you need
- If two components look identical, they should share a class/token rather than duplicating CSS
- Not everything must be reusable, but truly identical styles should be

### Uberiket API
- "Uberiket" means "unenriched" - no geometry on vegobjekter
- Geometry comes from the veglenker (road network)
- Must query veglenkesekvenser separately to get geometry
- Use `polygon` on the stream endpoint to find vegobjekter inside a drawn area
- Use `stedfesting` filter to find vegobjekter on specific veglenker

## Technical Stack

### Frontend
- **Runtime**: Bun
- **Framework**: React 18+ with TypeScript
- **Build**: Bun.serve() with HTML imports
- **Map Library**: OpenLayers 9+
- **Map Tiles**: Geodata.no XYZ (zoom 0-14) + Kartverket topo WMTS (zoom 15+)
- **Projections**: proj4 with EPSG:25833 (UTM33)
- **HTTP Client**: Axios
- **Data Fetching**: TanStack Query (React Query)
- **Geometry Manipulation**: Turf.js (@turf/along, @turf/length, @turf/helpers)
- **Styling**: Plain CSS

### API Integration
- **Datakatalog API**: `https://nvdbapiles.atlas.vegvesen.no/datakatalog/api/v1/`
  - Get all road object types with full details (`inkluder=alle`) - cached on load
  - Includes egenskapstyper and tillatte_verdier for enum resolution
  - Synchronous lookup via `getVegobjekttypeById()` after initial load
  
- **Uberiket API**: `https://nvdbapiles.atlas.vegvesen.no/uberiket/api/v1/`
- Query veglenkesekvenser by polygon or vegsystemreferanse
- Query vegobjekter by comma-separated type IDs and either stedfesting filter or vegsystemreferanse (always includes `dato`)
- Requests use `X-Client: nvdb-finn-vegdata`


### Code Generation
- Use `@hey-api/openapi-ts` for TypeScript client generation
- Specs are fetched from API docs endpoints via `bun run fetch:specs`
- Run `bunx openapi-ts` to regenerate clients after spec updates
- Generate Zod schemas and enable SDK request/response validation, but treat validation issues as runtime warnings when the upstream spec/implementation diverge

## Architecture

- `src/components/`: UI components (map controls/view, selectors, lists, detail views).
- `src/hooks/`: Query and orchestration logic for fetch/filter/render flows.
- `src/state/`: Shared application state (Jotai atoms) and URL-synced UI state.
- `src/api/`: API wrappers and integration helpers.
- `src/api/generated/`: Generated API clients/types (read-only; regenerate, do not hand-edit).
- `src/utils/`: Pure utilities for geometry, date handling, CSV export, parsing, and URL/history helpers.
- `src/index.css`: Global design tokens and component styles.
- `specs/`: OpenAPI source snapshots used for client generation.

## API Endpoints Used

### Datakatalog API
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/vegobjekttyper?inkluder=alle` | List all road object types with full details (egenskapstyper, tillatte_verdier) |

### Uberiket API
| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/vegnett/veglenkesekvenser` | Query road segments by polygon |
| `GET /api/v1/vegobjekter/stream?typeIder=...` | Stream road objects by type IDs with polygon/stedfesting/vegsystemreferanse as NDJSON (always includes `dato`) |

Query parameters:
- `polygon`: UTM33 polygon coordinates
- `vegsystemreferanse`: Vegsystemreferanse string (e.g., "FV6666 S1")
- `stedfesting`: Filter by position on veglenkesekvens (e.g., "0.4-0.6@123456")
- `dato`: Date for vegobjekt query (selected date when enabled, otherwise today's date)
- `inkluder`: Include stedfesting, egenskaper, gyldighetsperiode, barn
- `antall`: Limit results

### Veglenke Position Calculation

Each veglenke has a position range within its veglenkesekvens:
- Veglenkesekvens has `porter` array with `{nummer, posisjon}` entries
- Veglenke has `startport` and `sluttport` (port numbers)
- Position range is calculated by looking up the port positions: find porter where `nummer` matches `startport`/`sluttport`, then use their `posisjon` values

When querying vegobjekter in polygon mode, the app sends the drawn polygon directly to the Uberiket stream endpoint and parses the NDJSON response. Polygon clipping still affects how veglenker are rendered on the map, but it no longer changes the vegobjekt fetch filter.

## User Flow

1. **Load Application**
   - Map loads centered on Norway
   - Default zoom level is 4
    - Full datakatalog loads with `inkluder=alle` (shows "Laster datakatalog..." indicator)
    - All vegobjekttyper with egenskapstyper and tillatte_verdier are cached for synchronous lookup

2. **Select Object Types**
   - User searches by name or ID and selects types of interest
   - Category dropdown loads categories from datakatalog, sorted alphabetically, and selects all types in the chosen category
   - Skjermede (sensitive) vegobjekttyper er ikke tilgjengelige i listen
   - Selected types appear as removable chips for quick deselection
   - Must select at least one type before querying

3. **Choose Search Mode**
    - User toggles between polygon mode, strekning mode, and stedfesting mode
    - Switching search mode clears inputs/state from the other modes

4. **(Optional) Set Date Filter**
   - User can enable "Bruk dato" and select a date in the top control row
   - The date is committed on blur/Enter
   - This affects vegobjekt query date and client-side veglenke validity filtering

5. **Define Area/Route**
   - Polygon mode: click "Tegn område" and draw a small polygon (recommended: small area), or paste a polygon WKT and click "Søk"/"Kopier WKT"
   - Strekning mode: enter a vegsystemreferanse (e.g., "FV6666 S1") and click "Søk"
   - Stedfesting mode: enter stedfesting expressions (e.g., "1234, 0.2-0.5@5678") and click "Søk"
   - Polygon is converted to UTM33 coordinates

6. **Query and Display**
   - App queries veglenkesekvenser by polygon, vegsystemreferanse, or stedfesting IDs (configurable limit, default 500, max 1000)
   - Polygon and strekning searches show a warning when the veglenkesekvens result count hits the configured limit, since the map may not include all matches
   - Veglenker with geometry overlapping polygon are rendered on map
   - Veglenker are filtered client-side by gyldighetsperiode for the active reference date (`startdato` inclusive, `sluttdato` exclusive)
   - Stedfesting mode renders full veglenker in a lighter style and overlays clipped stedfesting geometry
   - Queries vegobjekter with the stream endpoint for polygon mode, strekning mode, and stedfesting mode
   - Includes `dato` in vegobjekt query (selected date when enabled, otherwise today's date)

7. **Inspect Vegobjekter**
    - Click on a veglenke to see related vegobjekter
    - Sidebar shows collapsible list of vegobjekter grouped by type
    - A filter button opens a popover to filter by gyldighetsperiode startdato
      - "Vis versjoner med startdato etter..." (client-side, after date - inclusive)
      - "Vis versjoner med startdato før..." (client-side, before date - exclusive)
    - Hovering over a vegobjekt in the list highlights its stedfestinger on the map
   - Locate button recenters the map on the vegobjekt's stedfesting geometry
    - Each vegobjekt displays:
      - ID with copy button
      - Versjon (shown in detail panel, not in list header)
      - Sist endret (ISO date derived from UTC timestamp in Norwegian timezone)
      - Gyldighetsperiode (validity period)
      - Stedfestinger (format: "0.2-0.8@1234")
      - Barn (child object references)
      - Egenskaper (properties with names mapped from datakatalog)
      - Polygon geometri-egenskaper include a "Kopier" link to copy the WKT
   - In veglenke popup, veglenkesekvens ID is a link to Uberiket API
   - Enum values are resolved to their display names

## URL Synchronization

The application synchronizes state with the URL for shareable links:
- **Map view**: Center coordinates and zoom level
- **Polygon**: Drawn selection polygon coordinates (polygon mode)
- **Strekning**: Vegsystemreferanse query (strekning mode)
- **Stedfesting**: Stedfesting expressions (stedfesting mode)
- **Date filter**: `dato=YYYY-MM-DD` when enabled
- **Selected types**: List of selected vegobjekttype IDs, or `types=all` when all are selected
- **Veglenkesekvens limit**: Max veglenkesekvenser selection (`veglenkesekvenslimit`)

## Data Model

### Veglenke (from veglenkesekvens)
```typescript
interface Veglenke {
  nummer: number;
  geometri: { wkt: string; srid: string };
  startport: number;
  sluttport: number;
}
```

### Vegobjekt stedfesting
```typescript
interface StedfestingLinje {
  id: number; // veglenkesekvens ID
  startposisjon: number;
  sluttposisjon: number;
}
```

### Vegobjekt Display Data
```typescript
interface VegobjektDisplay {
  id: number;
  typeId: number;
  typeName: string;
  versjonId?: number;
  sistEndret?: string;
  gyldighetsperiode?: {
    startdato: string;
    sluttdato?: string;
  };
  stedfestinger: string[]; // formatted as "0.2-0.8@1234"
  barn: { typeId: number; typeName: string; ids: number[] }[];
  egenskaper: { name: string; value: string }[];
}
```

### Egenskap Mapping
- Full datakatalog is fetched once on load with `inkluder=alle`
- Vegobjekttype lookup is synchronous via cached Map (`getVegobjekttypeById()`)
- Map egenskap ID to name using `egenskapstyper[].id` -> `egenskapstyper[].navn`
- For enum types, map value ID to display value using `tillatte_verdier[].id` -> `tillatte_verdier[].verdi` (full name), falling back to `kortnavn` if `verdi` is absent

## Overlap Check
To determine if a vegobjekt is on a specific veglenke:
1. Check if vegobjekt's stedfesting.id matches veglenkesekvens.id
2. Check if position ranges overlap

## CSV Export

A "Last ned CSV" button in the vegobjekt list header opens a popover (CSS anchor positioning) with two download options.

When the user clicks a download option, the app generates the CSV directly from the streamed result set that is already loaded in memory.

### Download Options
1. **Alle typer i én fil** — Downloads a single `vegobjekter.csv` containing a summary section at the top (TypeID, TypeNavn, Antall per type), followed by a blank line, then all vegobjekter across all types. Data headers: `TypeID`, `TypeNavn`, `ID`, `Versjon`, `Startdato`, `Sluttdato`, `Stedfesting`. No egenskaper columns.
2. **Fil per type (ZIP)** — Downloads a single `vegobjekter-per-type.zip` containing `sammendrag.csv` (TypeID, TypeNavn, Antall per type) plus one CSV file per vegobjekttype (e.g., `Skiltplate.csv`). Each type file includes common columns (`ID`, `Versjon`, `Startdato`, `Sluttdato`, `Stedfesting`) plus one dynamic column per unique egenskap name for that type. Geometry properties (GeometriEgenskap) are excluded.

## Future Enhancements (Out of Scope)

- More than 10 veglenker per query

## Geometri-egenskaper (Egengeometri)

Some vegobjekter have geometry properties (geometri-egenskaper) that represent the object's own geometry, independent of the road network. These are visualized separately from the stedfesting-based highlighting.

### Data Structure
```typescript
interface GeometriEgenskap {
  type: 'GeometriEgenskap';
  verdi: {
    wkt: string;      // WKT geometry (POINT, LINESTRING, POLYGON, etc.)
    srid: number;     // Coordinate reference system (e.g., 5973 = UTM33)
    lengde?: number;  // Length in meters (for lines)
  };
}
```

### Visualization
- Geometri-egenskaper are rendered on the map with a distinct style (purple)
- Point geometries are shown as circles
- Line geometries are shown as dashed lines  
- Polygon geometries are shown with semi-transparent fill
- Hovering over a vegobjekt highlights both its stedfesting AND its geometri-egenskaper
- Polygon geometri-egenskaper expose a WKT copy link in the details list
