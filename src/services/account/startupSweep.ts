import { wipeUserData } from '@/services/indexedDB/userPreferences'
import { PENDING_DELETION_KEY, clearTransientUserData } from './deleteAccount'

/**
 * - `none`: no deletion was pending.
 * - `cleared`: a marker was found while a user is signed in, so the deletion never reached Firebase.
 *   The marker is dropped silently and nothing is wiped.
 * - `wiped`: Firebase had already deleted the account; its leftover local data is gone.
 */
export type StartupSweepOutcome = 'none' | 'cleared' | 'wiped'

function readMarker(): string | null {
    try {
        return localStorage.getItem(PENDING_DELETION_KEY)
    } catch {
        return null
    }
}

function clearMarker() {
    try {
        localStorage.removeItem(PENDING_DELETION_KEY)
    } catch (error) {
        console.error('Could not clear the pending-deletion marker', error)
    }
}

/**
 * Heals an account deletion that was interrupted between `deleteUser` and the local wipe
 * (design Decision 4). Call it once at startup, after Firebase Auth has initialised.
 *
 * It only ever acts on a UID whose deletion started on this device (the marker). A user who merely
 * logged out leaves no marker, so their reading list survives. If wiping fails the marker stays,
 * so the next launch tries again.
 */
export async function runStartupSweep(signedInUid: string | null): Promise<StartupSweepOutcome> {
    const markedUid = readMarker()
    if (!markedUid) return 'none'

    if (signedInUid) {
        // Someone is signed in, so Firebase did not delete (or could not confirm deleting) the
        // marked account. Never wipe a live session's data: drop the marker and open normally.
        clearMarker()
        return 'cleared'
    }

    clearTransientUserData()
    await wipeUserData(markedUid)
    clearMarker()
    return 'wiped'
}
