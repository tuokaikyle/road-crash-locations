import { useEffect, useMemo, useState } from "react"
import { CarFront, LoaderCircle, RotateCcw, SlidersHorizontal } from "lucide-react"

import { CrashMap } from "@/components/crash-map"
import { FilterPanel, type CrashFilters } from "@/components/filter-panel"
import { Button } from "@/components/ui/button"
import { loadCrashes, SEVERITIES, type CrashRecord } from "@/lib/crashes"

const severityColors = ["#a22727", "#df5a36", "#dfa62e", "#2478a6"]
const DEFAULT_FILTERS: CrashFilters = {
  query: "",
  severities: [...SEVERITIES],
  month: "any",
  day: "any",
  timeRange: "any",
  crashType: "any",
  roadUser: "any",
  surface: "any",
}

function matchesTimeRange(hour: number, range: CrashFilters["timeRange"]) {
  if (range === "morning") return hour >= 5 && hour <= 11
  if (range === "afternoon") return hour >= 12 && hour <= 16
  if (range === "evening") return hour >= 17 && hour <= 20
  if (range === "night") return hour >= 21 || hour <= 4
  return true
}

function hasRoadUser(crash: CrashRecord, roadUser: CrashFilters["roadUser"]) {
  if (roadUser === "pedestrian") return crash.pedestrians > 0
  if (roadUser === "bicycle") return crash.bicycles > 0
  if (roadUser === "motorcycle") return crash.motorcycles > 0
  if (roadUser === "truck") return crash.trucks > 0
  return true
}

export function App() {
  const [crashes, setCrashes] = useState<CrashRecord[]>([])
  const [filters, setFilters] = useState<CrashFilters>(DEFAULT_FILTERS)
  const [error, setError] = useState("")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [fitRequest, setFitRequest] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    loadCrashes(controller.signal).then(setCrashes).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return
      setError(reason instanceof Error ? reason.message : "Unable to load crash data")
    })
    return () => controller.abort()
  }, [])

  const filteredCrashes = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase()

    return crashes.filter((crash) => {
      const searchable = [crash.street, crash.intersectingStreet, crash.stateRoadName, crash.suburb].join(" ").toLocaleLowerCase()
      return (
        (!query || searchable.includes(query)) &&
        filters.severities.includes(crash.severity) &&
        (filters.month === "any" || crash.month === filters.month) &&
        (filters.day === "any" || crash.dayOfWeek === filters.day) &&
        matchesTimeRange(crash.hour, filters.timeRange) &&
        (filters.crashType === "any" || crash.crashType === filters.crashType) &&
        hasRoadUser(crash, filters.roadUser) &&
        (filters.surface === "any" || crash.surfaceCondition === filters.surface)
      )
    })
  }, [crashes, filters])

  const activeFilterCount = useMemo(() => [
    Boolean(filters.query.trim()),
    filters.severities.length !== SEVERITIES.length,
    filters.month !== "any",
    filters.day !== "any",
    filters.timeRange !== "any",
    filters.crashType !== "any",
    filters.roadUser !== "any",
    filters.surface !== "any",
  ].filter(Boolean).length, [filters])

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setFitRequest((request) => request + 1)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark"><CarFront size={19} strokeWidth={2.2} /></div>
        <div className="brand-copy">
          <h1>Brisbane Crash Map</h1>
          <p>Road traffic crashes · Jan–Jun 2025</p>
        </div>
        <div className="header-count" aria-live="polite">
          <strong>{filteredCrashes.length.toLocaleString()}</strong>
          <span>{activeFilterCount ? `of ${crashes.length.toLocaleString()} crashes` : "crashes shown"}</span>
        </div>
        <Button variant="outline" size="sm" className="reset-button" onClick={resetFilters} disabled={!activeFilterCount}>
          <RotateCcw size={14} /> Reset
        </Button>
      </header>

      <section className="workspace">
        <div className="map-panel">
          {error ? (
            <div className="map-message"><strong>We couldn’t load the crash data.</strong><span>{error}</span></div>
          ) : crashes.length ? (
            <CrashMap crashes={filteredCrashes} fitRequest={fitRequest} />
          ) : (
            <div className="map-message"><LoaderCircle className="spin" /><span>Plotting crash locations…</span></div>
          )}

          {!error && crashes.length > 0 && filteredCrashes.length === 0 && (
            <div className="empty-results"><strong>No crashes match</strong><span>Try widening or resetting the filters.</span><Button size="sm" onClick={resetFilters}>Reset filters</Button></div>
          )}

          <div className="map-legend" aria-label="Crash severity legend">
            {SEVERITIES.map((severity, index) => (
              <span key={severity}><i style={{ backgroundColor: severityColors[index] }} />{severity}</span>
            ))}
          </div>

          <Button className="mobile-filter-trigger" type="button" onClick={() => setMobileFiltersOpen(true)}>
            <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
          </Button>
        </div>

        <FilterPanel
          filters={filters}
          crashes={crashes}
          activeCount={activeFilterCount}
          mobileOpen={mobileFiltersOpen}
          onChange={setFilters}
          onReset={resetFilters}
          onClose={() => setMobileFiltersOpen(false)}
        />
      </section>
    </main>
  )
}

export default App
