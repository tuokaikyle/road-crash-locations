export const SEVERITIES = [
  "Fatal",
  "Hospitalisation",
  "Medical treatment",
  "Minor injury",
] as const

export type CrashSeverity = (typeof SEVERITIES)[number]

export const SEVERITY_COLORS: Record<CrashSeverity, string> = {
  Fatal: "#450a0a",
  Hospitalisation: "#991b1b",
  "Medical treatment": "#dc2626",
  "Minor injury": "#f87171",
}

export const CRASH_DATASETS = [
  {
    id: "2025-h1",
    label: "2025 · Jan–Jun",
    description: "Jan–Jun 2025",
    url: "/_QLD_Road_Traffic_Crashes_csv__2025_june30.tsv",
  },
  {
    id: "2024",
    label: "2024 · Full year",
    description: "Full year 2024",
    url: "/_QLD_Road_Traffic_Crashes_csv__2024.tsv",
  },
] as const

export type CrashDatasetId = (typeof CRASH_DATASETS)[number]["id"]
export const DEFAULT_CRASH_DATASET_ID: CrashDatasetId = "2025-h1"

export type CrashRecord = {
  id: number
  reference: string
  severity: CrashSeverity
  year: number
  month: string
  dayOfWeek: string
  hour: number
  nature: string
  crashType: string
  longitude: number
  latitude: number
  street: string
  intersectingStreet: string
  stateRoadName: string
  suburb: string
  authority: string
  roadwayFeature: string
  trafficControl: string
  speedLimit: string
  surfaceCondition: string
  atmosphericCondition: string
  lightingCondition: string
  dcaDescription: string
  dcaGroup: string
  casualtyFatality: number
  casualtyHospitalised: number
  casualtyMedicalTreatment: number
  casualtyMinorInjury: number
  casualtyTotal: number
  cars: number
  motorcycles: number
  trucks: number
  buses: number
  bicycles: number
  pedestrians: number
  otherUnits: number
}

function parseTsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === "\t" && !quoted) {
      row.push(field)
      field = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      row.push(field)
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }

  row.push(field)
  if (row.some(Boolean)) rows.push(row)

  return rows
}

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function parseCrashes(text: string): CrashRecord[] {
  const [header, ...rows] = parseTsv(text)
  if (!header) return []

  const column = new Map(header.map((name, index) => [name, index]))
  const value = (row: string[], name: string) => row[column.get(name) ?? -1] ?? ""

  return rows.flatMap((row) => {
    const longitude = toNumber(value(row, "crash_longitude"))
    const latitude = toNumber(value(row, "crash_latitude"))
    const severity = value(row, "crash_severity") as CrashSeverity

    if (!longitude || !latitude || !SEVERITIES.includes(severity)) return []

    return [{
      id: toNumber(value(row, "_id")),
      reference: value(row, "crash_ref_number"),
      severity,
      year: toNumber(value(row, "crash_year")),
      month: value(row, "crash_month"),
      dayOfWeek: value(row, "crash_day_of_week"),
      hour: toNumber(value(row, "crash_hour")),
      nature: value(row, "crash_nature"),
      crashType: value(row, "crash_type"),
      longitude,
      latitude,
      street: value(row, "crash_street"),
      intersectingStreet: value(row, "crash_street_intersecting"),
      stateRoadName: value(row, "state_road_name"),
      suburb: value(row, "loc_suburb"),
      authority: value(row, "crash_controlling_authority"),
      roadwayFeature: value(row, "crash_roadway_feature"),
      trafficControl: value(row, "crash_traffic_control"),
      speedLimit: value(row, "crash_speed_limit"),
      surfaceCondition: value(row, "crash_road_surface_condition"),
      atmosphericCondition: value(row, "crash_atmospheric_condition"),
      lightingCondition: value(row, "crash_lighting_condition"),
      dcaDescription: value(row, "crash_dca_description"),
      dcaGroup: value(row, "crash_dca_group_description"),
      casualtyFatality: toNumber(value(row, "count_casualty_fatality")),
      casualtyHospitalised: toNumber(value(row, "count_casualty_hospitalised")),
      casualtyMedicalTreatment: toNumber(value(row, "count_casualty_medicallytreated")),
      casualtyMinorInjury: toNumber(value(row, "count_casualty_minorinjury")),
      casualtyTotal: toNumber(value(row, "count_casualty_total")),
      cars: toNumber(value(row, "count_unit_car")),
      motorcycles: toNumber(value(row, "count_unit_motorcycle_moped")),
      trucks: toNumber(value(row, "count_unit_truck")),
      buses: toNumber(value(row, "count_unit_bus")),
      bicycles: toNumber(value(row, "count_unit_bicycle")),
      pedestrians: toNumber(value(row, "count_unit_pedestrian")),
      otherUnits: toNumber(value(row, "count_unit_other")),
    }]
  })
}

export async function loadCrashes(
  datasetId: CrashDatasetId,
  signal?: AbortSignal
) {
  const dataset = CRASH_DATASETS.find((item) => item.id === datasetId)
  if (!dataset) throw new Error("Unknown crash dataset")

  const response = await fetch(dataset.url, { signal })
  if (!response.ok) throw new Error(`Unable to load crash data (${response.status})`)
  return parseCrashes(await response.text())
}
