import { useEffect, useMemo, useRef, useState } from "react"
import { Expand, Layers2, MapPin, Minimize2 } from "lucide-react"
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapLayerTouchEvent,
  type MapRef,
} from "react-map-gl/maplibre"
import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource } from "maplibre-gl"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { SEVERITY_COLORS, type CrashRecord } from "@/lib/crashes"

import "maplibre-gl/dist/maplibre-gl.css"

const BASEMAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  streets:
    import.meta.env.VITE_MAP_STYLE_URL ||
    "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const
const BASEMAP_STORAGE_KEY = "brisbane-crash-map-basemap"

type Basemap = keyof typeof BASEMAP_STYLES

const BASEMAP_OPTIONS: { value: Basemap; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "streets", label: "Streets" },
  { value: "dark", label: "Dark" },
]

function roadUserLabel(crash: CrashRecord) {
  const roadUsers: [string, number][] = [
    ["Pedestrian", crash.pedestrians],
    ["Bicycle", crash.bicycles],
    ["Motorcycle", crash.motorcycles],
    ["Truck", crash.trucks],
  ]

  return (
    roadUsers
      .filter(([, count]) => count > 0)
      .map(([label]) => label)
      .join(", ") || "None recorded"
  )
}

function getInitialBasemap(): Basemap {
  const storedBasemap = localStorage.getItem(BASEMAP_STORAGE_KEY)
  return storedBasemap && storedBasemap in BASEMAP_STYLES
    ? (storedBasemap as Basemap)
    : "light"
}

const clusterLayer: LayerProps = {
  id: "crash-clusters",
  type: "circle",
  source: "crashes",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#262626",
    "circle-radius": ["step", ["get", "point_count"], 20, 30, 25, 100, 32],
    "circle-stroke-width": 3,
    "circle-stroke-color": "rgba(255,255,255,.88)",
  },
}

const clusterCountLayer: LayerProps = {
  id: "crash-cluster-count",
  type: "symbol",
  source: "crashes",
  filter: ["has", "point_count"],
  layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
  paint: { "text-color": "#ffffff" },
}

const pointLayer: LayerProps = {
  id: "crash-points",
  type: "circle",
  source: "crashes",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "match",
      ["get", "severity"],
      "Fatal",
      SEVERITY_COLORS.Fatal,
      "Hospitalisation",
      SEVERITY_COLORS.Hospitalisation,
      "Medical treatment",
      SEVERITY_COLORS["Medical treatment"],
      SEVERITY_COLORS["Minor injury"],
    ],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4.5, 15, 8],
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
}

type CrashMapProps = {
  crashes: CrashRecord[]
  fitRequest: number
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

export function CrashMap({
  crashes,
  fitRequest,
  isFullscreen,
  onToggleFullscreen,
}: CrashMapProps) {
  const isMobileViewport = window.matchMedia("(max-width: 720px)").matches
  const mapRef = useRef<MapRef>(null)
  const handledFitRequest = useRef(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cursor, setCursor] = useState("grab")
  const [basemap, setBasemap] = useState<Basemap>(getInitialBasemap)
  const geoJson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: crashes.map((crash) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [crash.longitude, crash.latitude],
        },
        properties: { id: crash.id, severity: crash.severity },
      })),
    }),
    [crashes]
  )
  const selectedCrash =
    selectedId === null
      ? null
      : (crashes.find((crash) => crash.id === selectedId) ?? null)

  useEffect(() => {
    if (
      !fitRequest ||
      !crashes.length ||
      handledFitRequest.current === fitRequest
    )
      return
    handledFitRequest.current = fitRequest
    const bounds = crashes.reduce(
      (current, crash) =>
        [
          Math.min(current[0], crash.longitude),
          Math.min(current[1], crash.latitude),
          Math.max(current[2], crash.longitude),
          Math.max(current[3], crash.latitude),
        ] as [number, number, number, number],
      [Infinity, Infinity, -Infinity, -Infinity] as [
        number,
        number,
        number,
        number,
      ]
    )
    mapRef.current?.fitBounds(bounds, {
      padding: 72,
      duration: 700,
      maxZoom: isMobileViewport ? 9 : 14,
    })
  }, [fitRequest, crashes, isMobileViewport])

  const handleClick = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature || feature.layer.id !== "crash-clusters") return

    const clusterId = Number(feature.properties?.cluster_id)
    const source = mapRef.current?.getSource("crashes") as
      GeoJSONSource | undefined
    if (!source || !Number.isFinite(clusterId)) return
    const zoom = await source.getClusterExpansionZoom(clusterId)
    const [longitude, latitude] = (feature.geometry as Point).coordinates
    mapRef.current?.easeTo({
      center: [longitude, latitude],
      zoom,
      duration: 500,
    })
  }

  const handleTouchEnd = (event: MapLayerTouchEvent) => {
    const feature = event.features?.[0]
    setSelectedId(
      feature?.layer.id === "crash-points"
        ? Number(feature.properties?.id)
        : null
    )
  }

  const handleMouseMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    setCursor(feature ? "pointer" : "grab")
    setSelectedId(
      feature?.layer.id === "crash-points"
        ? Number(feature.properties?.id)
        : null
    )
  }

  const streetLabel = selectedCrash
    ? [selectedCrash.street, selectedCrash.intersectingStreet]
        .filter(Boolean)
        .join(" & ") ||
      selectedCrash.stateRoadName ||
      "Location recorded"
    : ""

  return (
    <Map
      ref={mapRef}
      workerUrl={maplibreWorkerUrl}
      initialViewState={{
        longitude: 153.03,
        latitude: -27.47,
        zoom: isMobileViewport ? 9 : 9.45,
      }}
      mapStyle={BASEMAP_STYLES[basemap]}
      maxBounds={[151.9, -28.4, 154.2, -26.4]}
      minZoom={isMobileViewport ? 8 : 10}
      interactiveLayerIds={["crash-clusters", "crash-points"]}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setCursor("grab")
        setSelectedId(null)
      }}
      cursor={cursor}
    >
      <NavigationControl position="top-left" showCompass={false} />
      <Source
        id="crashes"
        type="geojson"
        data={geoJson}
        cluster
        clusterMaxZoom={10}
        clusterRadius={36}
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...pointLayer} />
      </Source>
      {selectedCrash && (
        <Popup
          longitude={selectedCrash.longitude}
          latitude={selectedCrash.latitude}
          anchor="bottom"
          offset={10}
          maxWidth="310px"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedId(null)}
        >
          <article className="crash-popup">
            <h3 className="popup-kicker">
              <span
                className="severity-dot"
                style={{
                  backgroundColor: SEVERITY_COLORS[selectedCrash.severity],
                }}
              />
              {selectedCrash.severity}
            </h3>
            <div className="popup-place">
              <span className="popup-location">
                <MapPin size={13} />
                {streetLabel}, {selectedCrash.suburb}
              </span>
            </div>
            <dl>
              <div>
                <dt>Time</dt>
                <dd>
                  {String(selectedCrash.hour).padStart(2, "0")}:00 ·{" "}
                  {selectedCrash.dayOfWeek}
                </dd>
              </div>
              <div>
                <dt>Crash type</dt>
                <dd>{selectedCrash.crashType || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Road user</dt>
                <dd>{roadUserLabel(selectedCrash)}</dd>
              </div>
              <div>
                <dt>Road surface</dt>
                <dd>{selectedCrash.surfaceCondition || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Road feature</dt>
                <dd>{selectedCrash.roadwayFeature || "Not recorded"}</dd>
              </div>
              <div>
                <dt>DCA group</dt>
                <dd>
                  {selectedCrash.dcaGroup.replace(/^\d+: /, "") ||
                    "Not recorded"}
                </dd>
              </div>
            </dl>
            <small>Crash reference {selectedCrash.reference}</small>
          </article>
        </Popup>
      )}
      <div className="map-actions">
        <Button
          className="fullscreen-map-button"
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={isFullscreen ? "Exit full screen" : "View map in full screen"}
          title={isFullscreen ? "Exit full screen" : "View map in full screen"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 /> : <Expand />}
        </Button>
        <Select
          items={BASEMAP_OPTIONS}
          value={basemap}
          onValueChange={(nextBasemap) => {
            if (!nextBasemap) return
            setBasemap(nextBasemap)
            localStorage.setItem(BASEMAP_STORAGE_KEY, nextBasemap)
            setSelectedId(null)
          }}
        >
          <SelectTrigger
            className="basemap-trigger"
            size="sm"
            aria-label="Basemap style"
            title="Basemap style"
          >
            <Layers2 />
          </SelectTrigger>
          <SelectContent align="end">
            {BASEMAP_OPTIONS.map((option) => (
              <SelectItem value={option.value} key={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Map>
  )
}
