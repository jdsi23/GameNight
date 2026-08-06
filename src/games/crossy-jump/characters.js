export const CHARACTERS = [
  { id: 'frog', emoji: '🐸', label: 'Frog' },
  { id: 'chick', emoji: '🐥', label: 'Chick' },
  { id: 'rabbit', emoji: '🐰', label: 'Rabbit' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'bear', emoji: '🐻', label: 'Bear' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin' },
  { id: 'dino', emoji: '🦖', label: 'Dino' },
]

export function characterEmoji(id) {
  return CHARACTERS.find((c) => c.id === id)?.emoji ?? '❓'
}
