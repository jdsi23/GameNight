// All Blocker attacks are player-locked: you pick a runner, not a location, and the target is
// always guaranteed to get hit (no dodging by luck or timing). Cooldowns are tracked per attack
// type, so using one doesn't lock out the others. Fire additionally ignites the target's row for
// everyone else too — a real, visible hazard other runners can wander into, not just an
// invisible effect exclusive to the target.
export const ATTACKS = {
  squash: {
    id: 'squash',
    label: 'Traffic',
    description: 'Instantly hits the target with traffic — same respawn as getting run over.',
    cooldownMs: 16000,
    alert: 'Squashed by traffic!',
  },
  fire: {
    id: 'fire',
    label: 'Fire',
    description: "Sets the target's row ablaze for a few seconds — anyone standing in it gets hit.",
    cooldownMs: 14000,
    durationMs: 3000,
    alert: 'Caught in the fire!',
  },
  slow: {
    id: 'slow',
    label: 'Slow',
    description: "Saps the target's pace by 25% for 5 seconds.",
    cooldownMs: 10000,
    durationMs: 5000,
    moveCooldownMultiplier: 1.25,
    alert: 'Slowed by The Blocker!',
  },
}

export function cooldownRemaining(blockerAbility, type) {
  const entry = blockerAbility?.[type]
  if (!entry) return 0
  return Math.max(0, ATTACKS[type].cooldownMs - (Date.now() - entry.triggeredAt))
}
