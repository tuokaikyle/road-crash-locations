import { useEffect, useMemo, useRef, useState } from "react"
import { Focus, MapPin } from "lucide-react"
import Map, { Layer, NavigationControl, Popup, Source, type LayerProps, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre"
import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"

import type { CrashRecord } from "@/lib/crashes"

import "maplibre-gl/dist/maplibre-gl.css"

const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    openStreetMap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "openStreetMap", type: "raster", source: "openStreetMap" }],
}

const configuredMapStyle = import.meta.env.VITE_MAP_STYLE_URL || mapStyle

const clusterLayer: LayerProps = {
  id: "crash-clusters",
  type: "circle",
  source: "crashes",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": ["step", ["get", "point_count"], "#163b36", 30, "#0f6255", 100, "#0b7f69"],
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
    "circle-color": ["match", ["get", "severity"], "Fatal", "#a22727", "Hospitalisation", "#df5a36", "Medical treatment", "#dfa62e", "#2478a6"],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4.5, 15, 8],
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
}

type CrashMapProps = {
  crashes: CrashRecord[]
  fitRequest: number
}

export function CrashMap({ crashes, fitRequest }: CrashMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cursor, setCursor] = useState("grab")
  const geoJson = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: crashes.map((crash) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [crash.longitude, crash.latitude] },
        properties: { id: crash.id, severity: crash.severity },
      })),
    }),
    [crashes],
  )
  const selectedCrash = selectedId === null ? null : crashes.find((crash) => crash.id === selectedId) ?? null

  useEffect(() => {
    if (!fitRequest || !crashes.length) return
    const bounds = crashes.reduce(
      (current, crash) => [
        Math.min(current[0], crash.longitude),
        Math.min(current[1], crash.latitude),
        Math.max(current[2], crash.longitude),
        Math.max(current[3], crash.latitude),
      ] as [number, number, number, number],
      [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number],
    )
    mapRef.current?.fitBounds(bounds, { padding: 72, duration: 700, maxZoom: 14 })
  }, [fitRequest, crashes])

  const handleClick = async (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature) return

    if (feature.layer.id === "crash-clusters") {
      const clusterId = Number(feature.properties?.cluster_id)
      const source = mapRef.current?.getSource("crashes") as GeoJSONSource | undefined
      if (!source || !Number.isFinite(clusterId)) return
      const zoom = await source.getClusterExpansionZoom(clusterId)
      const [longitude, latitude] = (feature.geometry as Point).coordinates
      mapRef.current?.easeTo({ center: [longitude, latitude], zoom, duration: 500 })
      return
    }

    setSelectedId(Number(feature.properties?.id))
  }

  const streetLabel = selectedCrash
    ? [selectedCrash.street, selectedCrash.intersectingStreet].filter(Boolean).join(" & ") || selectedCrash.stateRoadName || "Location recorded"
    : ""

  return (
    <Map ref={mapRef}
      workerUrl={maplibreWorkerUrl}
      initialViewState={{ longitude: 153.03, latitude: -27.47, zoom: 9.45 }}
      mapStyle={configuredMapStyle}
      maxBounds={[151.9, -28.4, 154.2, -26.4]}
      minZoom={7}
      interactiveLayerIds={["crash-clusters", "crash-points"]}
      onClick={handleClick}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor("grab")}
      cursor={cursor}
    >
      <NavigationControl position="top-left" showCompass={false} />
      <Source id="crashes" type="geojson" data={geoJson} cluster clusterMaxZoom={14} clusterRadius={44}>
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
          closeOnClick={false}
          onClose={() => setSelectedId(null)}
        >
          <article className="crash-popup">
            <div className="popup-kicker"><span className={`severity-dot severity-${selectedCrash.severity.toLowerCase().replaceAll(" ", "-")}`} />{selectedCrash.severity}</div>
            <h3>{streetLabel}</h3>
            <p className="popup-location"><MapPin size={13} />{selectedCrash.suburb}</p>
            <dl>
              <div><dt>When</dt><dd>{selectedCrash.dayOfWeek}, {selectedCrash.month} · {String(selectedCrash.hour).padStart(2, "0")}:00</dd></div>
              <div><dt>Crash</dt><dd>{selectedCrash.nature} · {selectedCrash.crashType}</dd></div>
              <div><dt>Conditions</dt><dd>{selectedCrash.atmosphericCondition} · {selectedCrash.surfaceCondition}</dd></div>
              <div><dt>Casualties</dt><dd>{selectedCrash.casualtyTotal}</dd></div>
            </dl>
            <small>Crash reference {selectedCrash.reference}</small>
          </article>
        </Popup>
      )}
      <button className="fit-map-button" type="button" onClick={() => {
        if (!crashes.length) return
        const bounds = crashes.reduce((current, crash) => [Math.min(current[0], crash.longitude), Math.min(current[1], crash.latitude), Math.max(current[2], crash.longitude), Math.max(current[3], crash.latitude)] as [number, number, number, number], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number])
        mapRef.current?.fitBounds(bounds, { padding: 72, duration: 700, maxZoom: 14 })
      }}><Focus size={15} />Fit results</button>
    </Map>
  )
}
