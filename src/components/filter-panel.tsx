import { RotateCcw, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  SEVERITIES,
  SEVERITY_COLORS,
  type CrashRecord,
  type CrashSeverity,
} from "@/lib/crashes"

export type TimeRange = "any" | "morning" | "afternoon" | "evening" | "night"
export type RoadUser = "any" | "pedestrian" | "bicycle" | "motorcycle" | "truck"

export type CrashFilters = {
  query: string
  severities: CrashSeverity[]
  dayOfWeek: string
  timeRange: TimeRange
  crashType: string
  roadUser: RoadUser
  roadFeature: string
  dcaGroup: string
}

type FilterPanelProps = {
  filters: CrashFilters
  crashes: CrashRecord[]
  resultCount: number
  activeCount: number
  mobileOpen: boolean
  onChange: (next: CrashFilters) => void
  onClear: () => void
  onClose: () => void
}

const DAY_OF_WEEK_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
function sortedOptions(values: string[], preferredOrder?: string[]) {
  const unique = [...new Set(values.filter(Boolean))]
  if (preferredOrder)
    return unique.sort(
      (a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b)
    )
  return unique.sort((a, b) => a.localeCompare(b))
}

export function FilterPanel({
  filters,
  crashes,
  resultCount,
  activeCount,
  mobileOpen,
  onChange,
  onClear,
  onClose,
}: FilterPanelProps) {
  const daysOfWeek = sortedOptions(
    crashes.map((crash) => crash.dayOfWeek),
    DAY_OF_WEEK_ORDER
  )
  const crashTypes = sortedOptions(crashes.map((crash) => crash.crashType))
  const roadFeatures = sortedOptions(
    crashes.map((crash) => crash.roadwayFeature)
  )
  const dcaGroups = sortedOptions(crashes.map((crash) => crash.dcaGroup))
  const dcaGroupLabels = Object.fromEntries(
    dcaGroups.map((value) => [value, value.replace(/^\d+: /, "")])
  )
  const severityCounts = new Map(
    SEVERITIES.map((severity) => [
      severity,
      crashes.filter((crash) => crash.severity === severity).length,
    ])
  )

  const update = <Key extends keyof CrashFilters>(
    key: Key,
    value: CrashFilters[Key]
  ) => {
    onChange({ ...filters, [key]: value })
  }

  const toggleSeverity = (severity: CrashSeverity) => {
    const selected = filters.severities.includes(severity)
    update(
      "severities",
      selected
        ? filters.severities.filter((item) => item !== severity)
        : [...filters.severities, severity]
    )
  }

  const renderFilterContent = (mobile: boolean) => (
    <>
      <div className="filter-heading">
        <div className="filter-heading-titles">
          {mobile ? (
            <SheetTitle className="filter-title">Filter</SheetTitle>
          ) : (
            <h2>Filter</h2>
          )}
          <span className="heading-separator" aria-hidden="true">
            ·
          </span>
          <p className="filter-heading-count" aria-live="polite">
            <strong>{resultCount.toLocaleString()}</strong> results
          </p>
        </div>
        {mobile && (
          <SheetClose
            render={
              <Button
                className="mobile-close"
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Close filters"
              />
            }
          >
            <X />
          </SheetClose>
        )}
      </div>

      <div className="search-field">
        <Search className="search-icon" />
        <Input
          className="search-input"
          type="search"
          value={filters.query}
          onChange={(event) => update("query", event.target.value)}
          placeholder="Street or suburb"
          aria-label="Search street or suburb"
        />
        {filters.query && (
          <Button
            className="search-clear"
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => update("query", "")}
            aria-label="Clear search"
          >
            <X />
          </Button>
        )}
      </div>

      <fieldset className="filter-group">
        <legend>Severity</legend>
        {SEVERITIES.map((severity) => (
          <label className="check-row group/field-label" key={severity}>
            <span>
              <i style={{ backgroundColor: SEVERITY_COLORS[severity] }} />
              {severity}
            </span>
            <span className="check-meta">
              <small>
                {severityCounts.get(severity)?.toLocaleString()} in total
              </small>
              <Checkbox
                checked={filters.severities.includes(severity)}
                onCheckedChange={() => toggleSeverity(severity)}
              />
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group compact-group">
        <legend>When</legend>
        <SelectRow
          label="Day of week"
          value={filters.dayOfWeek}
          onChange={(value) => update("dayOfWeek", value)}
          options={daysOfWeek}
          allLabel="Any day"
        />
        <SelectRow
          label="Time of day"
          value={filters.timeRange}
          onChange={(value) => update("timeRange", value as TimeRange)}
          allLabel="Any time"
          options={["morning", "afternoon", "evening", "night"]}
          optionLabels={{
            morning: "Morning · 5–11",
            afternoon: "Afternoon · 12–16",
            evening: "Evening · 17–20",
            night: "Night · 21–4",
          }}
        />
      </fieldset>

      <fieldset className="filter-group compact-group">
        <legend>Crash details</legend>
        <SelectRow
          label="Crash type"
          value={filters.crashType}
          onChange={(value) => update("crashType", value)}
          options={crashTypes}
          allLabel="All types"
        />
        <SelectRow
          label="Road user"
          value={filters.roadUser}
          onChange={(value) => update("roadUser", value as RoadUser)}
          options={["pedestrian", "bicycle", "motorcycle", "truck"]}
          allLabel="Any road user"
          optionLabels={{
            pedestrian: "Pedestrian",
            bicycle: "Bicycle",
            motorcycle: "Motorcycle",
            truck: "Truck",
          }}
        />
        <SelectRow
          label="Road feature"
          value={filters.roadFeature}
          onChange={(value) => update("roadFeature", value)}
          options={roadFeatures}
          allLabel="Any road feature"
          wideMenu
        />
        <SelectRow
          label="DCA group"
          value={filters.dcaGroup}
          onChange={(value) => update("dcaGroup", value)}
          options={dcaGroups}
          optionLabels={dcaGroupLabels}
          allLabel="Any DCA group"
          wideMenu
        />
      </fieldset>

      {!mobile && (
        <div className="desktop-filter-footer">
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={!activeCount}
          >
            <RotateCcw />
            Reset
          </Button>
          <p className="filter-attribution">
            Data source:{" "}
            <a
              href="https://www.data.qld.gov.au/dataset/crash-data-from-queensland-roads/resource/e88943c0-5968-4972-a15f-38e120d72ec0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Road crash locations
            </a>{" "}
            (CC BY 4.0)
          </p>
        </div>
      )}

      {mobile && (
        <div className="mobile-filter-footer">
          <div className="mobile-filter-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={!activeCount}
            >
              <RotateCcw />
              Reset
            </Button>
            <SheetClose render={<Button type="button" />}>
              Show results
            </SheetClose>
          </div>
          <p className="filter-attribution">
            Data source:{" "}
            <a
              href="https://www.data.qld.gov.au/dataset/crash-data-from-queensland-roads/resource/e88943c0-5968-4972-a15f-38e120d72ec0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Road crash locations
            </a>{" "}
            (CC BY 4.0)
          </p>
        </div>
      )}
    </>
  )

  return (
    <>
      <aside
        className="filter-panel desktop-filter-panel"
        aria-label="Crash filters"
      >
        {renderFilterContent(false)}
      </aside>
      <Sheet
        open={mobileOpen}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <SheetContent
          className="mobile-filter-sheet"
          side="bottom"
          showCloseButton={false}
        >
          <SheetDescription className="sr-only">
            Filter crashes shown on the map.
          </SheetDescription>
          {renderFilterContent(true)}
        </SheetContent>
      </Sheet>
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
  wideMenu?: boolean
}

function SelectRow({
  label,
  value,
  options,
  allLabel,
  optionLabels,
  onChange,
  wideMenu = false,
}: SelectRowProps) {
  const items = [
    { value: "any", label: allLabel },
    ...options.map((option) => ({
      value: option,
      label: optionLabels?.[option] ?? option,
    })),
  ]

  return (
    <div className="select-row">
      <span>{label}</span>
      <Select
        items={items}
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue !== null) onChange(nextValue)
        }}
      >
        <SelectTrigger
          className="filter-select-trigger"
          size="sm"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align="end"
          className={wideMenu ? "wide-filter-select-content" : undefined}
        >
          <SelectItem value="any">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem value={option} key={option}>
              {optionLabels?.[option] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
