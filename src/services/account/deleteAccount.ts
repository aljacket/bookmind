import {
    EmailAuthProvider,
    deleteUser,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signOut
} from 'firebase/auth'
import { initAuth } from '@/services/firebase/config'
import { wipeUserData } from '@/services/indexedDB/userPreferences'

/** localStorage key holding the UID whose deletion has started on this device (design Decision 4). */
export const PENDING_DELETION_KEY = 'bookmind.pendingDeletion'

/** Why a deletion attempt stopped. Each kind maps to one state of the dialog (UX spec section 4). */
export type DeleteAccountErrorKind =
    | 'wrong-password'
    | 'too-many-attempts'
    | 'network'
    | 'reauth-needed'
    | 'session'
    | 'generic'

export class DeleteAccountError extends Error {
    readonly kind: DeleteAccountErrorKind
    /** The underlying Firebase error, for logging. */
    readonly original?: unknown

    constructor(kind: DeleteAccountErrorKind, original?: unknown) {
        super(`Account deletion failed: ${kind}`)
        this.name = 'DeleteAccountError'
        this.kind = kind
        this.original = original
    }
}

export function classifyDeleteAccountError(error: unknown): DeleteAccountErrorKind {
    const code = (error as { code?: unknown } | null)?.code
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/missing-password':
            return 'wrong-password'
        case 'auth/too-many-requests':
            return 'too-many-attempts'
        case 'auth/network-request-failed':
            return 'network'
        case 'auth/requires-recent-login':
            return 'reauth-needed'
        case 'auth/user-token-expired':
        case 'auth/user-mismatch':
        case 'auth/user-not-found':
            return 'session'
        default:
            return 'generic'
    }
}

/**
 * localStorage key where PreferencesPage hands the fresh AI recommendations to ProcessingPage, which
 * removes it again after reading. It is not uid-prefixed, but it holds the signed-in user's
 * recommendations, so it can linger if the app is closed during the 2 s hand-off.
 */
export const NEW_RECOMMENDATIONS_KEY = 'newRecommendations'

/** Removes user-derived data that lives outside IndexedDB and is not keyed by uid. */
export function clearTransientUserData() {
    try {
        localStorage.removeItem(NEW_RECOMMENDATIONS_KEY)
    } catch (error) {
        console.error('Could not clear transient user data', error)
    }
}

function clearMarker() {
    try {
        localStorage.removeItem(PENDING_DELETION_KEY)
    } catch (error) {
        console.error('Could not clear the pending-deletion marker', error)
    }
}

export interface DeleteAccountResult {
    uid: string
    /**
     * False when the Firebase user is gone but the local wipe failed. The marker is then kept, so the
     * startup sweep retries it at the next launch.
     */
    wiped: boolean
}

/**
 * Deletes the signed-in account, cloud first (design Decision 4):
 * reauthenticate, write the pending-deletion marker, `deleteUser`, `wipeUserData`, sign out.
 *
 * Throws `DeleteAccountError` for every failure up to and including `deleteUser`. In all of those
 * cases nothing was deleted, the user is still signed in and the marker is not left behind.
 * A failing local wipe is not an error: the account no longer exists, so the result says so.
 */
export async function deleteAccount(password: string): Promise<DeleteAccountResult> {
    const auth = initAuth()
    const user = auth.currentUser
    if (!user || !user.email) throw new DeleteAccountError('session')
    const uid = user.uid

    try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
    } catch (error) {
        throw new DeleteAccountError(classifyDeleteAccountError(error), error)
    }

    try {
        localStorage.setItem(PENDING_DELETION_KEY, uid)
    } catch (error) {
        // Without the marker an interrupted deletion could not heal, so do not start one.
        throw new DeleteAccountError('generic', error)
    }

    try {
        await deleteUser(user)
    } catch (error) {
        clearMarker()
        throw new DeleteAccountError(classifyDeleteAccountError(error), error)
    }

    // From here on the account is gone for good: nothing below may turn into a failure.
    clearTransientUserData()
    let wiped = true
    try {
        await wipeUserData(uid)
        clearMarker()
    } catch (error) {
        wiped = false
        console.error('Local data wipe failed; the startup sweep will retry it', error)
    }

    try {
        await signOut(auth)
    } catch (error) {
        console.error('Sign out after account deletion failed', error)
    }

    return { uid, wiped }
}

/**
 * Sends the Firebase password-reset email to the signed-in account's address, so the user can
 * reset the password from inside the deletion dialog. It never deletes anything.
 */
export async function sendAccountPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(initAuth(), email)
}
