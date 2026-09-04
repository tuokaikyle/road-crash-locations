import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SEVERITIES, type CrashRecord, type CrashSeverity } from "@/lib/crashes"

export type TimeRange = "any" | "morning" | "afternoon" | "evening" | "night"
export type RoadUser = "any" | "pedestrian" | "bicycle" | "motorcycle" | "truck"

export type CrashFilters = {
  query: string
  severities: CrashSeverity[]
  month: string
  day: string
  timeRange: TimeRange
  crashType: string
  roadUser: RoadUser
  surface: string
}

type FilterPanelProps = {
  filters: CrashFilters
  crashes: CrashRecord[]
  activeCount: number
  mobileOpen: boolean
  onChange: (next: CrashFilters) => void
  onReset: () => void
  onClose: () => void
}

const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const severityColors: Record<CrashSeverity, string> = {
  Fatal: "#a22727",
  Hospitalisation: "#df5a36",
  "Medical treatment": "#dfa62e",
  "Minor injury": "#2478a6",
}

function sortedOptions(values: string[], preferredOrder?: string[]) {
  const unique = [...new Set(values.filter(Boolean))]
  if (preferredOrder) return unique.sort((a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b))
  return unique.sort((a, b) => a.localeCompare(b))
}

export function FilterPanel({ filters, crashes, activeCount, mobileOpen, onChange, onReset, onClose }: FilterPanelProps) {
  const months = sortedOptions(crashes.map((crash) => crash.month), MONTH_ORDER)
  const days = sortedOptions(crashes.map((crash) => crash.dayOfWeek), DAY_ORDER)
  const crashTypes = sortedOptions(crashes.map((crash) => crash.crashType))
  const surfaces = sortedOptions(crashes.map((crash) => crash.surfaceCondition))
  const severityCounts = new Map(SEVERITIES.map((severity) => [severity, crashes.filter((crash) => crash.severity === severity).length]))

  const update = <Key extends keyof CrashFilters>(key: Key, value: CrashFilters[Key]) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleSeverity = (severity: CrashSeverity) => {
    const selected = filters.severities.includes(severity)
    update("severities", selected ? filters.severities.filter((item) => item !== severity) : [...filters.severities, severity])
  }

  return (
    <>
      <button className={`filter-backdrop ${mobileOpen ? "is-open" : ""}`} aria-label="Close filters" onClick={onClose} />
      <aside className={`filter-panel ${mobileOpen ? "is-open" : ""}`} aria-label="Crash filters">
        <div className="filter-heading">
          <div><span className="eyebrow">Explore the data</span><h2>Filter crashes</h2></div>
          <SlidersHorizontal className="desktop-filter-icon" size={18} />
          <button className="mobile-close" type="button" onClick={onClose} aria-label="Close filters"><X size={18} /></button>
        </div>

        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="Street or suburb"
            aria-label="Search street or suburb"
          />
          {filters.query && <button type="button" onClick={() => update("query", "")} aria-label="Clear search"><X size={14} /></button>}
        </label>

        <fieldset className="filter-group">
          <legend>Severity</legend>
          {SEVERITIES.map((severity) => (
            <label className="check-row" key={severity}>
              <span><i style={{ backgroundColor: severityColors[severity] }} />{severity}</span>
              <span className="check-meta"><small>{severityCounts.get(severity)?.toLocaleString()}</small><input type="checkbox" checked={filters.severities.includes(severity)} onChange={() => toggleSeverity(severity)} /></span>
            </label>
          ))}
        </fieldset>

        <fieldset className="filter-group compact-group">
          <legend>When</legend>
          <SelectRow label="Month" value={filters.month} onChange={(value) => update("month", value)} options={months} allLabel="All months" />
          <SelectRow label="Day of week" value={filters.day} onChange={(value) => update("day", value)} options={days} allLabel="All days" />
          <SelectRow
            label="Time of day"
            value={filters.timeRange}
            onChange={(value) => update("timeRange", value as TimeRange)}
            allLabel="Any time"
            options={["morning", "afternoon", "evening", "night"]}
            optionLabels={{ morning: "Morning · 5–11", afternoon: "Afternoon · 12–16", evening: "Evening · 17–20", night: "Night · 21–4" }}
          />
        </fieldset>

        <fieldset className="filter-group compact-group">
          <legend>Crash details</legend>
          <SelectRow label="Crash type" value={filters.crashType} onChange={(value) => update("crashType", value)} options={crashTypes} allLabel="All types" />
          <SelectRow
            label="Road user"
            value={filters.roadUser}
            onChange={(value) => update("roadUser", value as RoadUser)}
            options={["pedestrian", "bicycle", "motorcycle", "truck"]}
            allLabel="Any road user"
            optionLabels={{ pedestrian: "Pedestrian", bicycle: "Bicycle", motorcycle: "Motorcycle", truck: "Truck" }}
          />
          <SelectRow label="Road surface" value={filters.surface} onChange={(value) => update("surface", value)} options={surfaces} allLabel="Any surface" />
        </fieldset>

        <div className="mobile-filter-footer">
          <Button type="button" variant="outline" onClick={onReset} disabled={!activeCount}>Reset</Button>
          <Button type="button" onClick={onClose}>Show results</Button>
        </div>
      </aside>
    </>
  )
}

type SelectRowProps = {
  label: string
  value: string
  options: string[]
  allLabel: string
  optionLabels?: Record<string, string>
  onChange: (value: string) => void
}

function SelectRow({ label, value, options, allLabel, optionLabels, onChange }: SelectRowProps) {
  return (
    <label className="select-row">
      <span>{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="any">{allLabel}</option>
          {options.map((option) => <option value={option} key={option}>{optionLabels?.[option] ?? option}</option>)}
        </select>
        <ChevronDown size={13} />
      </span>
    </label>
  )
}

