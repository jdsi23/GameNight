// The course is never stored in the database — only a small integer `seed` is. Every client
// derives the exact same lane layout and car positions from (seed, row, elapsedSeconds), which
// is the only way this kind of continuous-motion game works over Firebase without a real game
// server: instead of syncing car positions many times a second, we sync nothing and just agree
// on the math.

function hash(seed, row) {
  let h = (seed ^ Math.imul(row + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

function rngFrom(seedInt) {
  let state = seedInt >>> 0
  return function rng() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The first few rows are always safe (a moment to get your bearings), and difficulty ramps up
// gradually after that rather than hitting full-speed, tightly-packed traffic immediately —
// early playtesting found row 1 could be an instant, unavoidable death depending on the seed,
// which felt like a bug rather than a game.
const SAFE_START_ROWS = 3
const RAMP_ROWS = 20
const ROAD_CHANCE_MIN = 0.25
const ROAD_CHANCE_MAX = 0.45
const MIN_SPEED = 0.9
const MAX_SPEED_MIN = 1.6
const MAX_SPEED_MAX = 2.6
const MIN_GAP = 3
const MAX_GAP = 5

/** Pure function of (seed, row) — the lane's static definition, never changes during a round. */
export function getLane(seed, row, finishRow) {
  if (row <= SAFE_START_ROWS || row >= finishRow) return { type: 'safe' }
  const difficulty = Math.min(1, (row - SAFE_START_ROWS) / RAMP_ROWS)
  const roadChance = ROAD_CHANCE_MIN + difficulty * (ROAD_CHANCE_MAX - ROAD_CHANCE_MIN)
  const maxSpeed = MAX_SPEED_MIN + difficulty * (MAX_SPEED_MAX - MAX_SPEED_MIN)

  const rng = rngFrom(hash(seed, row))
  if (rng() >= roadChance) return { type: 'safe' }
  const direction = rng() < 0.5 ? 1 : -1
  const speed = MIN_SPEED + rng() * (maxSpeed - MIN_SPEED)
  const gap = MIN_GAP + Math.floor(rng() * (MAX_GAP - MIN_GAP + 1))
  const offset = rng() * gap
  return { type: 'road', direction, speed, gap, offset }
}

/** Which columns currently have a car in them, given how long the round has been running. */
export function carColumnsAt(lane, width, elapsedSec, speedMultiplier = 1) {
  if (lane.type !== 'road') return []
  const shift = elapsedSec * lane.speed * speedMultiplier * lane.direction
  const cols = []
  for (let col = 0; col < width; col++) {
    const phase = (((col - lane.offset - shift) % lane.gap) + lane.gap) % lane.gap
    if (phase < 1) cols.push(col)
  }
  return cols
}
