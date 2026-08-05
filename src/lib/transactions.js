import { runTransaction } from 'firebase/database'

/**
 * Thin wrapper around Firebase's runTransaction for the "any client may attempt this
 * when it observes the precondition" pattern: the updater reads the live server value
 * and returns either a new value or `undefined` to abort (precondition no longer holds,
 * e.g. someone else already committed this transition).
 */
export async function attemptTransaction(nodeRef, updater) {
  try {
    const result = await runTransaction(nodeRef, updater)
    return { committed: result.committed, snapshot: result.snapshot }
  } catch (err) {
    // Rules rejection or a dropped connection mid-transaction. Not fatal for callers
    // using this as "try, and it's fine if it doesn't work" coordination.
    console.warn('Transaction failed', err)
    return { committed: false, snapshot: null }
  }
}
