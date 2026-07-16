import type { Env } from "../index"

const ACTIVE_STATUSES = ["planning", "preparing", "ready", "ongoing"] as const
const JOURNEY_STATUSES = ["draft", ...ACTIVE_STATUSES, "completed", "archived"] as const
type ActiveStatus = (typeof ACTIVE_STATUSES)[number]
type JourneyStatus = (typeof JOURNEY_STATUSES)[number]

interface JourneyRow {
  id: string
  name: string
  status: JourneyStatus
  departure_at: string | null
  destination_label: string | null
  preparedness: number
  pending_item_count: number
}

interface CreateJourneyInput {
  name?: unknown
  departureAt?: unknown
  destinationLabel?: unknown
}

interface UpdateJourneyInput {
  name?: unknown
  status?: unknown
  departureAt?: unknown
  destinationLabel?: unknown
  preparedness?: unknown
  pendingItemCount?: unknown
}

interface CreateJourneyStopInput {
  attractionId?: unknown
  label?: unknown
  latitude?: unknown
  longitude?: unknown
}

interface JourneyStopRow {
  id: string
  attraction_id: string | null
  label: string
  latitude: number
  longitude: number
  stop_order: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function serializeJourney(journey: JourneyRow) {
  return {
    id: journey.id,
    name: journey.name,
    status: journey.status,
    departureAt: journey.departure_at,
    destinationLabel: journey.destination_label,
    preparedness: journey.preparedness,
    pendingItemCount: journey.pending_item_count,
  }
}

export async function handleHomeContext(_request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding unavailable" }, 503)
  const preference = await env.DB.prepare(
    "SELECT is_first_visit, departure_threshold_hours FROM home_preferences WHERE id = 'default'",
  ).first<{ is_first_visit: number; departure_threshold_hours: number }>()
  const activeJourney = await env.DB.prepare(
    `SELECT id, name, status, departure_at, destination_label, preparedness, pending_item_count
       FROM journeys
       WHERE status IN (${ACTIVE_STATUSES.map(() => "?").join(",")})
       ORDER BY CASE WHEN departure_at IS NULL THEN 1 ELSE 0 END, departure_at ASC, updated_at DESC
       LIMIT 1`,
  ).bind(...ACTIVE_STATUSES).first<JourneyRow>()

  return json({
    isFirstVisit: preference ? Boolean(preference.is_first_visit) : true,
    departureThresholdHours: preference?.departure_threshold_hours ?? 72,
    activeJourney: activeJourney && serializeJourney(activeJourney),
  })
}

export async function handleHomePreference(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding unavailable" }, 503)
  const input = await request.json<Partial<{ isFirstVisit: boolean; departureThresholdHours: number }>>()
  if (input.departureThresholdHours !== undefined && (!Number.isInteger(input.departureThresholdHours) || input.departureThresholdHours <= 0)) {
    return json({ error: "departureThresholdHours must be a positive integer" }, 400)
  }
  const current = await env.DB.prepare(
    "SELECT is_first_visit, departure_threshold_hours FROM home_preferences WHERE id = 'default'",
  ).first<{ is_first_visit: number; departure_threshold_hours: number }>()
  const isFirstVisit = input.isFirstVisit ?? Boolean(current?.is_first_visit ?? true)
  const threshold = input.departureThresholdHours ?? current?.departure_threshold_hours ?? 72
  await env.DB.prepare(
    `INSERT INTO home_preferences (id, is_first_visit, departure_threshold_hours, updated_at)
     VALUES ('default', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET is_first_visit = excluded.is_first_visit,
       departure_threshold_hours = excluded.departure_threshold_hours, updated_at = excluded.updated_at`,
  ).bind(isFirstVisit ? 1 : 0, threshold, new Date().toISOString()).run()
  return handleHomeContext(request, env)
}

export async function handleCreateJourney(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding unavailable" }, 503)
  const input = await request.json<CreateJourneyInput>()
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const destinationLabel = typeof input.destinationLabel === "string" ? input.destinationLabel.trim() : ""
  const departureAt = typeof input.departureAt === "string" && input.departureAt ? new Date(input.departureAt) : null
  if (!name || name.length > 80) return json({ error: "name is required and must be 80 characters or fewer" }, 400)
  if (input.departureAt && (!departureAt || !Number.isFinite(departureAt.getTime()))) return json({ error: "departureAt must be an ISO date" }, 400)
  if (destinationLabel.length > 120) return json({ error: "destinationLabel must be 120 characters or fewer" }, 400)

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO journeys (id, name, status, departure_at, destination_label, preparedness, pending_item_count, created_at, updated_at)
     VALUES (?, ?, 'planning', ?, ?, 0, 0, ?, ?)`,
  ).bind(id, name, departureAt?.toISOString() ?? null, destinationLabel || null, now, now).run()
  await env.DB.prepare(
    "UPDATE home_preferences SET is_first_visit = 0, updated_at = ? WHERE id = 'default'",
  ).bind(now).run()
  return json({ id, name, status: "planning", departureAt: departureAt?.toISOString() ?? null, destinationLabel: destinationLabel || null, preparedness: 0, pendingItemCount: 0 }, 201)
}

/** Update only user-managed Journey planning fields; lifecycle values stay explicit. */
export async function handleUpdateJourney(request: Request, env: Env, id: string): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding unavailable" }, 503)
  const input = await request.json<UpdateJourneyInput>()
  const current = await env.DB.prepare(
    "SELECT id, name, status, departure_at, destination_label, preparedness, pending_item_count FROM journeys WHERE id = ?",
  ).bind(id).first<JourneyRow>()
  if (!current) return json({ error: "Journey not found" }, 404)

  const name = input.name === undefined ? current.name : typeof input.name === "string" ? input.name.trim() : ""
  const status = input.status === undefined ? current.status : input.status
  const destinationLabel = input.destinationLabel === undefined
    ? current.destination_label
    : typeof input.destinationLabel === "string" ? input.destinationLabel.trim() || null : input.destinationLabel === null ? null : ""
  const departureAt = input.departureAt === undefined
    ? current.departure_at
    : typeof input.departureAt === "string" && input.departureAt ? new Date(input.departureAt) : input.departureAt === null ? null : false
  const preparedness: unknown = input.preparedness === undefined ? current.preparedness : input.preparedness
  const pendingItemCount: unknown = input.pendingItemCount === undefined ? current.pending_item_count : input.pendingItemCount

  if (!name || name.length > 80) return json({ error: "name must be 1 to 80 characters" }, 400)
  if (typeof status !== "string" || !JOURNEY_STATUSES.includes(status as JourneyStatus)) return json({ error: "status is invalid" }, 400)
  if (destinationLabel !== null && (typeof destinationLabel !== "string" || destinationLabel.length > 120)) return json({ error: "destinationLabel must be 120 characters or fewer" }, 400)
  if (departureAt === false || (departureAt instanceof Date && !Number.isFinite(departureAt.getTime()))) return json({ error: "departureAt must be an ISO date or null" }, 400)
  if (typeof preparedness !== "number" || !Number.isInteger(preparedness) || preparedness < 0 || preparedness > 100) return json({ error: "preparedness must be an integer from 0 to 100" }, 400)
  if (typeof pendingItemCount !== "number" || !Number.isInteger(pendingItemCount) || pendingItemCount < 0) return json({ error: "pendingItemCount must be a non-negative integer" }, 400)

  const updatedAt = new Date().toISOString()
  const next: JourneyRow = {
    id: current.id,
    name,
    status: status as JourneyStatus,
    departure_at: departureAt instanceof Date ? departureAt.toISOString() : departureAt,
    destination_label: destinationLabel,
    preparedness,
    pending_item_count: pendingItemCount,
  }
  await env.DB.prepare(
    `UPDATE journeys
     SET name = ?, status = ?, departure_at = ?, destination_label = ?, preparedness = ?, pending_item_count = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(next.name, next.status, next.departure_at, next.destination_label, next.preparedness, next.pending_item_count, updatedAt, id).run()
  return json(serializeJourney(next))
}

/** Route order is created only from a user action on a POI, never recommendation rank. */
export async function handleJourneyStops(request: Request, env: Env, journeyId: string): Promise<Response> {
  if (!env.DB) return json({ error: "D1 binding unavailable" }, 503)
  if (request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, attraction_id, label, latitude, longitude, stop_order FROM journey_stops WHERE journey_id = ? ORDER BY stop_order ASC",
    ).bind(journeyId).all<JourneyStopRow>()
    return json({ stops: rows.results.map(row => ({ id: row.id, attractionId: row.attraction_id, label: row.label, latitude: row.latitude, longitude: row.longitude, order: row.stop_order })) })
  }
  const input = await request.json<CreateJourneyStopInput>()
  const label = typeof input.label === "string" ? input.label.trim() : ""
  const attractionId = typeof input.attractionId === "string" ? input.attractionId.trim() : null
  const latitude = input.latitude
  const longitude = input.longitude
  if (!label || label.length > 120) return json({ error: "label must be 1 to 120 characters" }, 400)
  if (typeof latitude !== "number" || latitude < -90 || latitude > 90 || typeof longitude !== "number" || longitude < -180 || longitude > 180) return json({ error: "latitude and longitude must be valid WGS-84 coordinates" }, 400)
  const journey = await env.DB.prepare("SELECT id FROM journeys WHERE id = ?").bind(journeyId).first<{ id: string }>()
  if (!journey) return json({ error: "Journey not found" }, 404)
  const existing = attractionId ? await env.DB.prepare("SELECT id FROM journey_stops WHERE journey_id = ? AND attraction_id = ?").bind(journeyId, attractionId).first<{ id: string }>() : null
  if (existing) return json({ error: "This destination is already in the Journey" }, 409)
  const order = await env.DB.prepare("SELECT COALESCE(MAX(stop_order), 0) + 1 AS next_order FROM journey_stops WHERE journey_id = ?").bind(journeyId).first<{ next_order: number }>()
  const now = new Date().toISOString()
  const stop: JourneyStopRow = { id: crypto.randomUUID(), attraction_id: attractionId || null, label, latitude, longitude, stop_order: order?.next_order ?? 1 }
  await env.DB.prepare(
    "INSERT INTO journey_stops (id, journey_id, attraction_id, label, latitude, longitude, stop_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(stop.id, journeyId, stop.attraction_id, stop.label, stop.latitude, stop.longitude, stop.stop_order, now).run()
  return json({ id: stop.id, attractionId: stop.attraction_id, label: stop.label, latitude: stop.latitude, longitude: stop.longitude, order: stop.stop_order }, 201)
}
