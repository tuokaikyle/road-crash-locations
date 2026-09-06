import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Expand, Filter, Layers2, Minimize2 } from "lucide-react"
import * as L from "leaflet"
import Supercluster from "supercluster"
import type { Feature, Point } from "geojson"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  SEVERITY_COLORS,
  type CrashRecord,
  type CrashSeverity,
} from "@/lib/crashes"

import "leaflet/dist/leaflet.css"

const BASEMAPS = {
  openstreetmap: {
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  opentopomap: {
    label: "OpenTopoMap",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.opentopomap.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
} as const
const BASEMAP_STORAGE_KEY = "brisbane-crash-map-basemap"
const INITIAL_ZOOM = 10
const FIT_MAX_ZOOM = 10
const CLUSTER_INDEX_RADIUS = 96

type Basemap = keyof typeof BASEMAPS
type CrashFeatureProperties = { id: number; severity: CrashSeverity }

const BASEMAP_OPTIONS: { value: Basemap; label: string }[] = [
  { value: "openstreetmap", label: "OpenStreetMap" },
  { value: "opentopomap", label: "OpenTopoMap" },
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
  return storedBasemap && storedBasemap in BASEMAPS
    ? (storedBasemap as Basemap)
    : "openstreetmap"
}

function popupRows(crash: CrashRecord): [string, string][] {
  return [
    ["Time", `${String(crash.hour).padStart(2, "0")}:00 · ${crash.dayOfWeek}`],
    ["Crash type", crash.crashType || "Not recorded"],
    ["Road user", roadUserLabel(crash)],
    ["Road surface", crash.surfaceCondition || "Not recorded"],
    ["Road feature", crash.roadwayFeature || "Not recorded"],
    ["DCA group", crash.dcaGroup.replace(/^\d+: /, "") || "Not recorded"],
  ]
}

function createTooltipContent(crash: CrashRecord) {
  const tag = document.createElement("div")
  tag.className = "crash-tooltip"

  // Header: severity label.
  const header = document.createElement("div")
  header.className = "crash-tooltip-header"

  const title = document.createElement("strong")
  title.className = "crash-tooltip-title"
  const dot = document.createElement("span")
  dot.className = "severity-dot"
  dot.style.backgroundColor = SEVERITY_COLORS[crash.severity]
  const heading = document.createElement("span")
  heading.textContent = crash.severity
  title.append(dot, heading)
  header.append(title)
  tag.append(header)

  // Location line.
  const streetLabel =
    [crash.street, crash.intersectingStreet].filter(Boolean).join(" & ") ||
    crash.stateRoadName ||
    "Location recorded"
  const place = document.createElement("span")
  place.className = "crash-tooltip-place"
  place.textContent = `${streetLabel}, ${crash.suburb}`
  tag.append(place)

  // Attribute rows in the exact order shown in main's popup: Time first, then
  // crash type, road user, road surface, road feature, and DCA group.
  const list = document.createElement("dl")
  list.className = "crash-tooltip-rows"
  for (const [label, value] of popupRows(crash)) {
    const row = document.createElement("div")
    const term = document.createElement("dt")
    term.textContent = label
    const definition = document.createElement("dd")
    definition.textContent = value
    row.append(term, definition)
    list.append(row)
  }
  tag.append(list)

  // Reference footer, mirroring main's small print at the bottom.
  const reference = document.createElement("span")
  reference.className = "crash-tooltip-reference"
  reference.textContent = `Crash reference ${crash.reference}`
  tag.append(reference)
  return tag
}

function clusterRadius(pointCount: number) {
  if (pointCount >= 100) return 24
  if (pointCount >= 30) return 20
  return 16
}

function pointRadius(zoom: number) {
  return Math.min(8, Math.max(4.5, 4.5 + (zoom - 9) * 0.58))
}

type CrashMapProps = {
  crashes: CrashRecord[]
  fitRequest: number
  isFullscreen: boolean
  onToggleFullscreen: () => void
  activeFilterCount: number
  mobileFiltersOpen: boolean
  onOpenFilters: () => void
}

export function CrashMap({
  crashes,
  fitRequest,
  isFullscreen,
  onToggleFullscreen,
  activeFilterCount,
  mobileFiltersOpen,
  onOpenFilters,
}: CrashMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const canvasRendererRef = useRef<L.Canvas | null>(null)
  const clusterIndexRef = useRef<Supercluster<CrashFeatureProperties> | null>(
    null
  )
  const redrawRef = useRef<() => void>(() => undefined)
  const handledFitRequest = useRef(0)
  const [basemap, setBasemap] = useState<Basemap>(getInitialBasemap)

  const crashFeatures = useMemo<Feature<Point, CrashFeatureProperties>[]>(
    () =>
      crashes.map((crash) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [crash.longitude, crash.latitude],
        },
        properties: { id: crash.id, severity: crash.severity },
      })),
    [crashes]
  )
  const crashesById = useMemo(
    () => new Map(crashes.map((crash) => [crash.id, crash])),
    [crashes]
  )

  const redrawMarkers = useCallback(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    const canvasRenderer = canvasRendererRef.current
    const clusterIndex = clusterIndexRef.current
    if (!map || !markerLayer || !canvasRenderer || !clusterIndex) return

    markerLayer.clearLayers()
    const bounds = map.getBounds()
    const zoom = Math.round(map.getZoom())
    const features = clusterIndex.getClusters(
      [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ],
      zoom
    )

    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates
      const position: L.LatLngExpression = [latitude, longitude]

      if ("cluster" in feature.properties && feature.properties.cluster) {
        const { cluster_id: clusterId, point_count: pointCount } =
          feature.properties
        const radius = clusterRadius(pointCount)
        const marker = L.marker(position, {
          icon: L.divIcon({
            className: "crash-cluster-marker",
            html: `<span>${pointCount}</span>`,
            iconSize: [radius * 2, radius * 2],
            iconAnchor: [radius, radius],
          }),
          keyboard: true,
          title: `${pointCount} crashes. Tap to zoom in.`,
        })
        marker.on("click", () => {
          map.flyTo(position, clusterIndex.getClusterExpansionZoom(clusterId), {
            duration: 0.5,
          })
        })
        markerLayer.addLayer(marker)
        continue
      }

      const crash = crashesById.get(feature.properties.id)
      if (!crash) continue
      const marker = L.circleMarker(position, {
        renderer: canvasRenderer,
        radius: pointRadius(zoom),
        color: "#ffffff",
        weight: 1.5,
        fillColor: SEVERITY_COLORS[crash.severity],
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
      marker.bindTooltip(createTooltipContent(crash), {
        direction: "top",
        opacity: 1,
        className: "crash-tooltip-container",
      })
      marker.on("click", () => {
        marker.openTooltip()
      })
      markerLayer.addLayer(marker)
    }
  }, [crashesById])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    const map = L.map(container, {
      center: [-27.47, 153.03],
      zoom: INITIAL_ZOOM,
      minZoom: 6,
      maxBounds: [
        [-28.4, 151.9],
        [-26.4, 154.2],
      ],
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    })
    const markerLayer = L.layerGroup().addTo(map)
    const canvasRenderer = L.canvas({ padding: 0.25 })
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, debounceMoveend: true })
    })

    mapRef.current = map
    markerLayerRef.current = markerLayer
    canvasRendererRef.current = canvasRenderer
    resizeObserver.observe(container)
    map.on("moveend zoomend", () => redrawRef.current())

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      canvasRendererRef.current = null
      tileLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    tileLayerRef.current?.remove()
    tileLayerRef.current = L.tileLayer(BASEMAPS[basemap].url, {
      attribution: BASEMAPS[basemap].attribution,
      maxZoom: 19,
    }).addTo(map)
  }, [basemap])

  useEffect(() => {
    const clusterIndex = new Supercluster<CrashFeatureProperties>({
      radius: CLUSTER_INDEX_RADIUS,
      maxZoom: 10,
    })
    clusterIndex.load(crashFeatures)
    clusterIndexRef.current = clusterIndex
    redrawRef.current()
  }, [crashFeatures])

  useEffect(() => {
    redrawRef.current = redrawMarkers
    redrawMarkers()
  }, [redrawMarkers])

  useEffect(() => {
    if (
      !fitRequest ||
      !crashes.length ||
      handledFitRequest.current === fitRequest
    )
      return
    const map = mapRef.current
    if (!map) return

    handledFitRequest.current = fitRequest
    map.fitBounds(
      crashes.map((crash) => [crash.latitude, crash.longitude]),
      {
        padding: [72, 72],
        maxZoom: FIT_MAX_ZOOM,
        animate: true,
        duration: 0.7,
      }
    )
  }, [crashes, fitRequest])

  useEffect(() => {
    mapRef.current?.invalidateSize({ pan: false })
  }, [isFullscreen])

  return (
    <>
      <div className="leaflet-map" ref={mapContainerRef} />
      <div className="map-actions">
        <Button
          className="mobile-filter-trigger"
          type="button"
          size="icon-sm"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={mobileFiltersOpen}
          aria-label="Open filters"
          title="Open filters"
          onClick={onOpenFilters}
        >
          <Filter size={14} />
          {activeFilterCount > 0 && (
            <Badge className="filter-count-badge" variant="secondary">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
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
    </>
  )
}
