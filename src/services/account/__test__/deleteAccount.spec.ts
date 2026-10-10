import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calls, firebaseAuth, mocks } = vi.hoisted(() => {
    const calls: string[] = []
    const firebaseAuth: { currentUser: { uid: string; email: string } | null } = {
        currentUser: null
    }
    const mocks = {
        reauth: vi.fn(),
        deleteUser: vi.fn(),
        signOut: vi.fn(),
        sendPasswordResetEmail: vi.fn(),
        wipeUserData: vi.fn()
    }
    return { calls, firebaseAuth, mocks }
})

vi.mock('firebase/auth', () => ({
    EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
    reauthenticateWithCredential: mocks.reauth,
    deleteUser: mocks.deleteUser,
    signOut: mocks.signOut,
    sendPasswordResetEmail: mocks.sendPasswordResetEmail
}))
vi.mock('@/services/firebase/config', () => ({ initAuth: () => firebaseAuth }))
vi.mock('@/services/indexedDB/userPreferences', () => ({ wipeUserData: mocks.wipeUserData }))

import {
    DeleteAccountError,
    PENDING_DELETION_KEY,
    classifyDeleteAccountError,
    deleteAccount,
    sendAccountPasswordReset
} from '../deleteAccount'

const authError = (code: string) => Object.assign(new Error(code), { code })
const kindOf = async (promise: Promise<unknown>) => {
    try {
        await promise
    } catch (error) {
        expect(error).toBeInstanceOf(DeleteAccountError)
        return (error as DeleteAccountError).kind
    }
    throw new Error('expected the deletion to fail')
}

describe('deleteAccount', () => {
    beforeEach(() => {
        calls.length = 0
        localStorage.clear()
        firebaseAuth.currentUser = { uid: 'uid-1', email: 'reader@example.com' }
        mocks.reauth.mockReset().mockImplementation(async () => void calls.push('reauth'))
        mocks.deleteUser.mockReset().mockImplementation(async () => {
            calls.push(`deleteUser(marker=${localStorage.getItem(PENDING_DELETION_KEY)})`)
        })
        mocks.wipeUserData.mockReset().mockImplementation(async (uid: string) => {
            calls.push(`wipe(${uid})`)
        })
        mocks.signOut.mockReset().mockImplementation(async () => void calls.push('signOut'))
        mocks.sendPasswordResetEmail.mockReset().mockResolvedValue(undefined)
    })

    it('runs cloud first: reauthenticate, marker, deleteUser, wipe, signOut', async () => {
        const result = await deleteAccount('correct horse')

        expect(calls).toEqual(['reauth', 'deleteUser(marker=uid-1)', 'wipe(uid-1)', 'signOut'])
        expect(mocks.reauth).toHaveBeenCalledWith(firebaseAuth.currentUser, {
            email: 'reader@example.com',
            password: 'correct horse'
        })
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
        expect(result).toEqual({ uid: 'uid-1', wiped: true })
    })

    it.each([
        ['auth/invalid-credential', 'wrong-password'],
        ['auth/wrong-password', 'wrong-password'],
        ['auth/missing-password', 'wrong-password'],
        ['auth/too-many-requests', 'too-many-attempts'],
        ['auth/network-request-failed', 'network'],
        ['auth/something-else', 'generic']
    ])('reauthentication failing with %s deletes nothing (%s)', async (code, kind) => {
        mocks.reauth.mockRejectedValue(authError(code))

        expect(await kindOf(deleteAccount('nope'))).toBe(kind)

        expect(mocks.deleteUser).not.toHaveBeenCalled()
        expect(mocks.wipeUserData).not.toHaveBeenCalled()
        expect(mocks.signOut).not.toHaveBeenCalled()
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
    })

    it.each([
        ['auth/network-request-failed', 'network'],
        ['auth/requires-recent-login', 'reauth-needed'],
        ['auth/user-token-expired', 'session'],
        ['auth/internal-error', 'generic']
    ])(
        'deleteUser failing with %s wipes nothing and clears the marker (%s)',
        async (code, kind) => {
            mocks.deleteUser.mockRejectedValue(authError(code))

            expect(await kindOf(deleteAccount('pw'))).toBe(kind)

            expect(mocks.wipeUserData).not.toHaveBeenCalled()
            expect(mocks.signOut).not.toHaveBeenCalled()
            expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
        }
    )

    it('reports a session error when nobody is signed in, without touching anything', async () => {
        firebaseAuth.currentUser = null

        expect(await kindOf(deleteAccount('pw'))).toBe('session')

        expect(mocks.reauth).not.toHaveBeenCalled()
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
    })

    it('does not start a deletion it could not heal if the marker cannot be written', async () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota')
        })

        expect(await kindOf(deleteAccount('pw'))).toBe('generic')
        setItem.mockRestore()

        expect(mocks.deleteUser).not.toHaveBeenCalled()
    })

    it('still succeeds when the local wipe fails, and keeps the marker for the startup sweep', async () => {
        mocks.wipeUserData.mockRejectedValue(new Error('idb blocked'))
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = await deleteAccount('pw')

        expect(result).toEqual({ uid: 'uid-1', wiped: false })
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBe('uid-1')
        expect(mocks.signOut).toHaveBeenCalled()
        errorLog.mockRestore()
    })
})

describe('classifyDeleteAccountError', () => {
    it('maps the session-gone codes to session and anything unknown to generic', () => {
        for (const code of [
            'auth/user-token-expired',
            'auth/user-mismatch',
            'auth/user-not-found'
        ]) {
            expect(classifyDeleteAccountError({ code })).toBe('session')
        }
        expect(classifyDeleteAccountError(new Error('plain'))).toBe('generic')
        expect(classifyDeleteAccountError(null)).toBe('generic')
    })
})

describe('sendAccountPasswordReset', () => {
    it('sends the Firebase reset email to the given address and deletes nothing', async () => {
        mocks.sendPasswordResetEmail.mockReset().mockResolvedValue(undefined)
        mocks.deleteUser.mockReset()
        mocks.wipeUserData.mockReset()
        localStorage.clear()

        await sendAccountPasswordReset('reader@example.com')

        expect(mocks.sendPasswordResetEmail).toHaveBeenCalledOnce()
        expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
            firebaseAuth,
            'reader@example.com'
        )
        expect(mocks.deleteUser).not.toHaveBeenCalled()
        expect(mocks.wipeUserData).not.toHaveBeenCalled()
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
    })
})
