import WhatsMyNumber from './whats-my-number/WhatsMyNumber'
import IsItThatBad from './is-it-that-bad/IsItThatBad'
import WhoWroteThat from './who-wrote-that/WhoWroteThat'
import HowFunnyAreYou from './how-funny-are-you/HowFunnyAreYou'
import CrossyJump from './crossy-jump/CrossyJump'

export const GAMES = [
  {
    id: 'whats-my-number',
    name: "What's My Number?",
    description:
      'Everyone gets a secret number only the group can see. Guess your own before you run out of tries.',
    minPlayers: 2,
    component: WhatsMyNumber,
  },
  {
    id: 'is-it-that-bad',
    name: 'Is It Really That Bad?',
    description:
      'Everyone sees the topic. Only one player is secretly playing it Good or Evil — grill them with scenario questions for 5 minutes, then guess which way they were leaning.',
    minPlayers: 2,
    component: IsItThatBad,
  },
  {
    id: 'who-wrote-that',
    name: 'Who Wrote That?',
    description:
      'A classic paragraph gets vandalized one word at a time. Race to claim a line and ruin it.',
    minPlayers: 2,
    component: WhoWroteThat,
  },
  {
    id: 'how-funny-are-you',
    name: 'How Funny Are You?',
    description:
      'Each round a rotating judge rates your jokes 1-10. Once someone hits 15 points, the floor starts rising — fall below the average and you\'re out.',
    minPlayers: 2,
    component: HowFunnyAreYou,
  },
  {
    id: 'crossy-jump',
    name: 'Crossy Jump',
    description:
      'Hop across traffic to reach the finish line while one secret Blocker speeds up the cars to stop you.',
    minPlayers: 2,
    component: CrossyJump,
  },
]

export function getGame(gameId) {
  return GAMES.find((g) => g.id === gameId)
}
