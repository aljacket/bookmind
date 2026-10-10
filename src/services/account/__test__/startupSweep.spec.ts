import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getReadingList, saveReadingList } from '@/services/indexedDB/userPreferences'
import { installFakeIndexedDB } from '@/services/indexedDB/__test__/fakeIndexedDB'
import { PENDING_DELETION_KEY } from '../deleteAccount'
import { runStartupSweep } from '../startupSweep'

vi.mock('@/services/firebase/config', () => ({ initAuth: () => ({}) }))

const book = (title: string) => ({ title, author: 'Author', reason: 'because' })
const titles = async (uid: string) => (await getReadingList(uid)).map((b) => b.title)

describe('runStartupSweep', () => {
    beforeEach(async () => {
        installFakeIndexedDB()
        localStorage.clear()
        await saveReadingList('uid-deleted', [book('Orphan')])
        await saveReadingList('uid-other', [book('Keep me')])
    })

    it('with the marker present and nobody signed in, wipes only that uid and clears the marker', async () => {
        localStorage.setItem(PENDING_DELETION_KEY, 'uid-deleted')

        expect(await runStartupSweep(null)).toBe('wiped')

        expect(await titles('uid-deleted')).toEqual([])
        expect(await titles('uid-other')).toEqual(['Keep me'])
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
    })

    it('after a normal logout (no marker) keeps every reading list', async () => {
        // Logout leaves no marker; the next launch has no signed-in user either.
        expect(await runStartupSweep(null)).toBe('none')

        expect(await titles('uid-deleted')).toEqual(['Orphan'])
        expect(await titles('uid-other')).toEqual(['Keep me'])
    })

    it('with the marker present while the same user is still signed in, clears it and wipes nothing', async () => {
        localStorage.setItem(PENDING_DELETION_KEY, 'uid-deleted')

        expect(await runStartupSweep('uid-deleted')).toBe('cleared')

        expect(await titles('uid-deleted')).toEqual(['Orphan'])
        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBeNull()
    })

    it('never wipes while any user is signed in, even a different one', async () => {
        localStorage.setItem(PENDING_DELETION_KEY, 'uid-deleted')

        expect(await runStartupSweep('uid-other')).toBe('cleared')

        expect(await titles('uid-deleted')).toEqual(['Orphan'])
        expect(await titles('uid-other')).toEqual(['Keep me'])
    })

    it('keeps the marker when the wipe fails, so the next launch retries', async () => {
        localStorage.setItem(PENDING_DELETION_KEY, 'uid-deleted')
        vi.stubGlobal('indexedDB', {
            open: () => {
                const request: { onerror?: () => void } = {}
                queueMicrotask(() => request.onerror?.())
                return request
            }
        })

        await expect(runStartupSweep(null)).rejects.toBeDefined()

        expect(localStorage.getItem(PENDING_DELETION_KEY)).toBe('uid-deleted')
    })
})
