# Brisbane Crash Map

An interactive map for exploring Queensland road-traffic crash records in the
Brisbane area. Choose a dataset, narrow it with filters, and inspect individual
crashes directly on the map.

The application is a client-side Vite app: the bundled TSV datasets are parsed
in the browser and rendered as a clustered MapLibre GeoJSON layer. No backend
is required.

## Highlights

- Clustered map markers that expand as you zoom in.
- Severity legend for Fatal, Hospitalisation, Medical treatment, and Minor injury crashes.
- Crash popups with the day and time, crash type, involved road users, road
  surface, road feature, DCA group, location, and crash reference.
- Desktop filtering sidebar and a mobile bottom-sheet equivalent.
- Search by street or suburb, plus filters for severity, month, time of day,
  crash type, road user, road surface, road feature, and DCA group.
- 2024 full-year and 2025 Jan–Jun dataset snapshots.
- Light, streets, and dark basemaps; the selected style is remembered locally.
- Full-screen map mode and touch-friendly crash selection on mobile.

## Stack

- [React](https://react.dev) and [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev) and [Bun](https://bun.sh)
- [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), and [Base UI](https://base-ui.com)
- [MapLibre GL](https://maplibre.org) with [`react-map-gl`](https://visgl.github.io/react-map-gl)
- [Lucide](https://lucide.dev) icons

## Run locally

Prerequisite: [Bun](https://bun.sh) 1.3 or later.

```bash
bun install
bun run dev
```

Vite prints the local URL when the development server is ready.

### Useful commands

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `bun run dev`       | Start the development server.                        |
| `bun run build`     | Type-check and create a production build in `dist/`. |
| `bun run preview`   | Serve the production build locally.                  |
| `bun run lint`      | Run ESLint.                                          |
| `bun run typecheck` | Run TypeScript without emitting files.               |
| `bun run format`    | Format TypeScript and TSX files with Prettier.       |

## Deploy to Cloudflare Pages

Use the following build settings:

| Setting                | Value           |
| ---------------------- | --------------- |
| Build command          | `bun run build` |
| Build output directory | `dist`          |

Cloudflare Pages can install dependencies from the committed `bun.lock` file.

## Data

The data is sourced from [Road crash locations](https://www.data.qld.gov.au/dataset/crash-data-from-queensland-roads/resource/e88943c0-5968-4972-a15f-38e120d72ec0), with a Creative Commons Attribution 4.0 license.

The shipped data snapshots live in `public/`:

- `_QLD_Road_Traffic_Crashes_csv__2024.tsv`
- `_QLD_Road_Traffic_Crashes_csv__2025_june30.tsv`

`src/lib/crashes.ts` contains the dataset registry and TSV parser. Rows without
valid coordinates or a recognised severity are ignored. The parser only maps
fields used by the interface.

To add a snapshot:

1. Put the TSV file in `public/`.
2. Add its id, label, description, and URL to `CRASH_DATASETS` in
   `src/lib/crashes.ts`.
3. Keep the expected source columns intact, then run `bun run build`.

The data is a historical snapshot, not a live incident feed. Validate it
against the originating Queensland open-data release before using it for
operational or safety-critical decisions.

## Project structure

```text
src/
├── App.tsx                     # Layout, data loading, filter and full-screen state
├── components/
│   ├── crash-map.tsx           # MapLibre map, clustering, controls, and crash popup
│   ├── filter-panel.tsx        # Desktop sidebar and mobile filter sheet
│   └── ui/                     # Shared Base UI / shadcn components
├── lib/
│   └── crashes.ts              # Dataset registry, types, and TSV parsing
└── index.css                   # App layout and responsive styling
```

## Configuration

Set `VITE_MAP_STYLE_URL` to override the URL used by the **Streets** basemap:

```bash
VITE_MAP_STYLE_URL="https://example.com/style.json" bun run dev
```

The light and dark map styles use OpenFreeMap by default.
