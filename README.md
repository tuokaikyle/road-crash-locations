# Brisbane Crash Map

A lightweight interactive map of **road traffic crashes in Brisbane** (Queensland,
Australia), built from open-data spreadsheets published by the Queensland
government's crash reporting.

Data is heavy, but the app stays light: crash rows are parsed client-side into a
GeoJSON layer and rendered with **MapLibre GL clustering** on the GPU, so React
never re-renders individual points — even with thousands of crashes on screen.

## Features

- **Clustered crash map** — circles that merge into count clusters and expand as you zoom.
- **Severity styling & legend** — Fatal / Hospitalisation / Medical treatment / Minor injury.
- **Crash detail popups** — tap a point for time, crash nature/type, road conditions, casualties, and the report reference.
- **Rich filtering sidebar** (mobile: bottom sheet):
  - Street / suburb search
  - Severity (multi-select)
  - Month · time of day
  - Crash type · road user · road surface
  - **Road feature** (intersections, merge lanes, roundabouts, …)
  - **DCA group** (Definition for Classifying Accidents scenario codes, e.g. Rear-end, Hit Pedestrian)
- **Multiple datasets** — switch between the full 2024 and the Jan–Jun 2025 snapshots.
- **Basemap switcher** — Light / Streets / Dark (persisted in `localStorage`).
- **Responsive** desktop layout + mobile filter sheet.

## Tech

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (`base-nova` style on `@base-ui/react`)
- [MapLibre GL](https://maplibre.org) via [`react-map-gl`](https://visgl.github.io/react-map-gl)
- [lucide-react](https://lucide.dev) icons

## Getting started

```bash
bun install      # or npm install
bun dev          # start the dev server
bun run build    # type-check + production build
bun run lint     # run eslint
bun run typecheck
```

Crash data lives in `public/` as tab-separated files matching the columns the
parser in `src/lib/crashes.ts` expects. The parser is dependency-free and reads
only the fields the UI needs.

## Where things live

- `src/App.tsx` — layout, data loading, filter state & logic
- `src/components/crash-map.tsx` — the MapLibre map, clustering, popups
- `src/components/filter-panel.tsx` — desktop sidebar + mobile filter sheet
- `src/lib/crashes.ts` — TSV parsing, crash types & dataset registry

## Adding components (shadcn)

```bash
npx shadcn@latest add button
```

This places the ui components in `src/components/ui`.

## Using components

```tsx
import { Button } from "@/components/ui/button"
```

