import { useEffect, useMemo, useRef, useState } from "react"
import { LoaderCircle, Road } from "lucide-react"

import { CrashMap } from "@/components/crash-map"
import { FilterPanel, type CrashFilters } from "@/components/filter-panel"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CRASH_DATASETS,
  DEFAULT_CRASH_DATASET_ID,
  loadCrashes,
  SEVERITIES,
  SEVERITY_COLORS,
  type CrashDatasetId,
  type CrashRecord,
} from "@/lib/crashes"

const DEFAULT_FILTERS: CrashFilters = {
  query: "",
  severities: [...SEVERITIES],
  dayOfWeek: "any",
  timeRange: "any",
  crashTypes: [],
  roadUsers: [],
  roadFeatures: [],
  dcaGroups: [],
}

function matchesTimeRange(hour: number, range: CrashFilters["timeRange"]) {
  if (range === "morning") return hour >= 5 && hour <= 11
  if (range === "afternoon") return hour >= 12 && hour <= 16
  if (range === "evening") return hour >= 17 && hour <= 20
  if (range === "night") return hour >= 21 || hour <= 4
  return true
}

function hasRoadUser(
  crash: CrashRecord,
  roadUser: CrashFilters["roadUsers"][number]
) {
  if (roadUser === "pedestrian") return crash.pedestrians > 0
  if (roadUser === "bicycle") return crash.bicycles > 0
  if (roadUser === "motorcycle") return crash.motorcycles > 0
  if (roadUser === "truck") return crash.trucks > 0
  return true
}

export function App() {
  const [crashes, setCrashes] = useState<CrashRecord[]>([])
  const [datasetId, setDatasetId] = useState<CrashDatasetId>(
    DEFAULT_CRASH_DATASET_ID
  )
  const [filters, setFilters] = useState<CrashFilters>(DEFAULT_FILTERS)
  const [error, setError] = useState("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [emptyResultsDismissed, setEmptyResultsDismissed] = useState(false)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const mapPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadCrashes(datasetId, controller.signal)
      .then(setCrashes)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return
        setError(
          reason instanceof Error ? reason.message : "Unable to load crash data"
        )
      })
    return () => controller.abort()
  }, [datasetId])

  const selectedDataset = CRASH_DATASETS.find(
    (dataset) => dataset.id === datasetId
  )!

  const filteredCrashes = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase()

    return crashes.filter((crash) => {
      const searchable = [
        crash.street,
        crash.intersectingStreet,
        crash.stateRoadName,
        crash.suburb,
      ]
        .join(" ")
        .toLocaleLowerCase()
      return (
        (!query || searchable.includes(query)) &&
        filters.severities.includes(crash.severity) &&
        (filters.dayOfWeek === "any" ||
          crash.dayOfWeek === filters.dayOfWeek) &&
        matchesTimeRange(crash.hour, filters.timeRange) &&
        (!filters.crashTypes.length ||
          filters.crashTypes.includes(crash.crashType)) &&
        (!filters.roadUsers.length ||
          filters.roadUsers.some((roadUser) => hasRoadUser(crash, roadUser))) &&
        (!filters.roadFeatures.length ||
          filters.roadFeatures.includes(crash.roadwayFeature)) &&
        (!filters.dcaGroups.length ||
          filters.dcaGroups.includes(crash.dcaGroup))
      )
    })
  }, [crashes, filters])

  const activeFilterCount = useMemo(
    () =>
      [
        Boolean(filters.query.trim()),
        filters.severities.length !== SEVERITIES.length,
        filters.dayOfWeek !== "any",
        filters.timeRange !== "any",
        filters.crashTypes.length > 0,
        filters.roadUsers.length > 0,
        filters.roadFeatures.length > 0,
        filters.dcaGroups.length > 0,
      ].filter(Boolean).length,
    [filters]
  )

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setEmptyResultsDismissed(false)
  }

  const handleFiltersChange = (nextFilters: CrashFilters) => {
    setFilters(nextFilters)
    setEmptyResultsDismissed(false)
  }

  useEffect(() => {
    if (
      !crashes.length ||
      filteredCrashes.length !== 0 ||
      emptyResultsDismissed
    )
      return

    const timeout = window.setTimeout(
      () => setEmptyResultsDismissed(true),
      5000
    )
    return () => window.clearTimeout(timeout)
  }, [crashes.length, emptyResultsDismissed, filteredCrashes.length])

  useEffect(() => {
    const updateFullscreenState = () => {
      setMapFullscreen(document.fullscreenElement === mapPanelRef.current)
    }
    document.addEventListener("fullscreenchange", updateFullscreenState)
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreenState)
  }, [])

  const toggleMapFullscreen = () => {
    const mapPanel = mapPanelRef.current
    if (!mapPanel) return

    const fullscreenAction =
      document.fullscreenElement === mapPanel
        ? document.exitFullscreen()
        : mapPanel.requestFullscreen()
    void fullscreenAction.catch(() => undefined)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          <Road size={19} strokeWidth={2.2} />
        </div>
        <div className="brand-copy">
          <h1>Brisbane Crash Map</h1>
          <p>Road traffic crashes · {selectedDataset.description}</p>
        </div>
        <Select
          items={CRASH_DATASETS.map((dataset) => ({
            value: dataset.id,
            label: dataset.label,
          }))}
          value={datasetId}
          onValueChange={(nextDatasetId) => {
            if (!nextDatasetId) return
            setCrashes([])
            setError("")
            setDatasetId(nextDatasetId)
            setFilters(DEFAULT_FILTERS)
            setEmptyResultsDismissed(false)
          }}
        >
          <SelectTrigger
            className="dataset-selector"
            size="sm"
            aria-label="Crash dataset"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {CRASH_DATASETS.map((dataset) => (
              <SelectItem value={dataset.id} key={dataset.id}>
                {dataset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </header>

      <section className="workspace">
        <div className="map-panel" ref={mapPanelRef}>
          {error ? (
            <div className="map-message">
              <strong>We couldn’t load the crash data.</strong>
              <span>{error}</span>
            </div>
          ) : crashes.length ? (
            <CrashMap
              crashes={filteredCrashes}
              fitRequest={1}
              isFullscreen={mapFullscreen}
              onToggleFullscreen={toggleMapFullscreen}
              activeFilterCount={activeFilterCount}
              mobileFiltersOpen={mobileFiltersOpen}
              onOpenFilters={() => setMobileFiltersOpen(true)}
            />
          ) : (
            <div className="map-message">
              <LoaderCircle className="spin" />
              <span>Plotting crash locations…</span>
            </div>
          )}

          {!error &&
            crashes.length > 0 &&
            filteredCrashes.length === 0 &&
            !emptyResultsDismissed && (
              <div className="empty-results-toast" role="status">
                <div>
                  <strong>No crashes match</strong>
                  <span>Try widening or resetting the filters.</span>
                </div>
              </div>
            )}

          <div className="map-legend" aria-label="Crash severity legend">
            {SEVERITIES.map((severity) => (
              <span key={severity}>
                <i style={{ backgroundColor: SEVERITY_COLORS[severity] }} />
                {severity}
              </span>
            ))}
          </div>
        </div>

        <FilterPanel
          filters={filters}
          crashes={crashes}
          resultCount={filteredCrashes.length}
          activeCount={activeFilterCount}
          mobileOpen={mobileFiltersOpen}
          onChange={handleFiltersChange}
          onClear={clearFilters}
          onClose={() => setMobileFiltersOpen(false)}
        />
      </section>
    </main>
  )
}

export default App
