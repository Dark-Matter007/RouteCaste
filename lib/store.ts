// ---------------------------------------------------------------------------
// Event store. In-memory for now; this is the ONE module that gets swapped for
// Neon later. The API layer and frontend never change when that happens.
// ---------------------------------------------------------------------------

export type Invitee = {
  id: string
  name: string
  originNodeId: string
}

export type EventPlan = {
  id: string
  name: string
  venueNodeId: string
  invitees: Invitee[]
}

// Grid dimensions must match lib/city.ts (8x8). The venue sits at the center.
const ROWS = 8
const COLS = 8
const VENUE = "n4_4"

// Real guest names so each invitee is a distinct person. Shuffled per-city
// (by seed) so different locations show different, non-repeating names.
const NAMES = [
  "Aisha Khan",
  "Marcus Reid",
  "Elena Duarte",
  "Kenji Tanaka",
  "Priya Nair",
  "Liam O'Brien",
  "Sofia Rossi",
  "Noah Berg",
  "Chloe Martin",
  "Omar Haddad",
  "Hana Kim",
  "Diego Alvarez",
  "Fatima Zahra",
  "Lucas Silva",
  "Mia Andersson",
  "Rohan Mehta",
]

// A default event for the demo (stable, Manhattan).
const defaultEvent: EventPlan = {
  id: "evt_demo",
  name: "Product Launch Summit",
  venueNodeId: VENUE,
  invitees: [
    { id: "i1", name: "Aisha Khan", originNodeId: "n0_1" },
    { id: "i2", name: "Marcus Reid", originNodeId: "n7_0" },
    { id: "i3", name: "Elena Duarte", originNodeId: "n1_7" },
    { id: "i4", name: "Kenji Tanaka", originNodeId: "n7_6" },
    { id: "i5", name: "Priya Nair", originNodeId: "n2_3" },
  ],
}

let event: EventPlan = defaultEvent

export function getEvent(): EventPlan {
  return event
}

export function updateEvent(next: Partial<EventPlan>): EventPlan {
  event = { ...event, ...next }
  return event
}

// Small deterministic PRNG so a given city always yields the same invitees.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Auto-generate an event with `count` invitees placed pseudo-randomly around
 * the grid (never on the venue). `seed` is derived from the city coordinates
 * so each city gets its own stable set of guests.
 */
export function buildEvent(seed: number, count = 5): EventPlan {
  const rand = mulberry32(seed)
  const n = Math.max(3, Math.min(NAMES.length, count))
  const used = new Set<string>([VENUE])
  const invitees: Invitee[] = []

  // Shuffle the name pool with the same seed so each city gets a distinct,
  // non-repeating set of guest names.
  const names = [...NAMES]
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[names[i], names[j]] = [names[j], names[i]]
  }

  for (let i = 0; i < n; i++) {
    let id = VENUE
    let guard = 0
    while (used.has(id) && guard++ < 50) {
      const r = Math.floor(rand() * ROWS)
      const c = Math.floor(rand() * COLS)
      id = `n${r}_${c}`
    }
    used.add(id)
    invitees.push({ id: `i${i + 1}`, name: names[i], originNodeId: id })
  }

  return { id: "evt_auto", name: "Event Attendees", venueNodeId: VENUE, invitees }
}
