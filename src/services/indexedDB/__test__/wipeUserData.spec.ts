import { beforeEach, describe, expect, it } from 'vitest'
import {
    getLastRecommendations,
    getReadingList,
    saveLastRecommendations,
    saveReadingList,
    wipeUserData
} from '../userPreferences'
import { installFakeIndexedDB, type FakeIndexedDB } from './fakeIndexedDB'

const book = (title: string) => ({ title, author: 'Author', reason: 'because' })

// Raw access to the three stores, so the test sees every key (including ones no API reads).
function allKeys(fake: FakeIndexedDB): Record<string, string[]> {
    const stores = fake.stores('BookMindDB')
    return Object.fromEntries(
        ['userPreferences', 'apiCalls', 'readingList'].map((name) => [
            name,
            [...stores.get(name)!.keys()].sort()
        ])
    )
}

function putRaw(fake: FakeIndexedDB, store: string, key: string, value: unknown) {
    fake.stores('BookMindDB').get(store)!.set(key, value)
}

describe('wipeUserData', () => {
    let fake: FakeIndexedDB

    beforeEach(() => {
        fake = installFakeIndexedDB()
    })

    it('removes every ${uid}_ key from all three stores and keeps the other uids', async () => {
        // Real data through the app's own API.
        await saveReadingList('uid-a', [book('A1')])
        await saveReadingList('uid-b', [book('B1')])
        await saveLastRecommendations('uid-a', [book('A-rec')])
        await saveLastRecommendations('uid-b', [book('B-rec')])
        // Keys that only exist in the schema: call counter and consent flag, plus lookalike uids.
        putRaw(fake, 'apiCalls', 'uid-a_apiCalls', { count: 1 })
        putRaw(fake, 'apiCalls', 'uid-b_apiCalls', { count: 2 })
        putRaw(fake, 'userPreferences', 'uid-a_aiConsent', { granted: true })
        putRaw(fake, 'userPreferences', 'uid-ab_readingList', ['lookalike prefix'])
        putRaw(fake, 'userPreferences', 'uid_a_other', 'underscore lookalike')

        await wipeUserData('uid-a')

        expect(allKeys(fake)).toEqual({
            userPreferences: ['uid-ab_readingList', 'uid-b_lastRecommendations', 'uid_a_other'],
            apiCalls: ['uid-b_apiCalls'],
            readingList: ['uid-b_readingList']
        })
        expect(await getReadingList('uid-a')).toEqual([])
        expect(await getLastRecommendations('uid-a')).toBeNull()
        expect((await getReadingList('uid-b')).map((b) => b.title)).toEqual(['B1'])
    })

    it('is a no-op for a uid with no data', async () => {
        await saveReadingList('uid-b', [book('B1')])

        await expect(wipeUserData('uid-unknown')).resolves.toBeUndefined()

        expect((await getReadingList('uid-b')).map((b) => b.title)).toEqual(['B1'])
    })

    it('refuses an empty uid, which would make the prefix a bare underscore', async () => {
        await expect(wipeUserData('')).rejects.toThrow()
    })
})
