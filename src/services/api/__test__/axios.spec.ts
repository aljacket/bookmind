import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, type AxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'

const { getIdToken, firebaseAuth } = vi.hoisted(() => {
    const getIdToken = vi.fn()
    const firebaseAuth: { currentUser: { getIdToken: typeof getIdToken } | null } = {
        currentUser: null
    }
    return { getIdToken, firebaseAuth }
})

vi.mock('@/services/firebase/config', () => ({ auth: firebaseAuth }))
vi.mock('@/services/indexedDB/userPreferences', () => ({
    getReadingList: vi.fn().mockResolvedValue([])
}))

import api, { RECOMMENDATION_TIMEOUT_MS, classifyApiError } from '../axios'
import { fetchClarifier, fetchRecommendations } from '../../recommendations/bookRecommendation'

// Replaces the network: records the request config that reached the adapter.
let seen: AxiosRequestConfig[] = []
api.defaults.adapter = async (config) => {
    seen.push(config)
    return { data: { question: 'q' }, status: 200, statusText: 'OK', headers: {}, config }
}

const authorizationOf = (config: AxiosRequestConfig) =>
    (config.headers as unknown as { get(name: string): string | undefined }).get('Authorization')

describe('api request interceptor', () => {
    beforeEach(() => {
        seen = []
        getIdToken.mockReset().mockResolvedValue('token-abc')
        firebaseAuth.currentUser = { getIdToken }
        setActivePinia(createPinia())
    })

    it.each([['/recommendations/clarify'], ['/recommendations'], ['/reports']])(
        'sends Authorization: Bearer <ID token> on POST %s',
        async (path) => {
            await api.post(path, {})

            expect(seen).toHaveLength(1)
            expect(authorizationOf(seen[0])).toBe('Bearer token-abc')
        }
    )

    it('asks Firebase for the token on every call, so a refreshed token is picked up', async () => {
        await api.post('/recommendations', {})
        getIdToken.mockResolvedValue('token-new')
        await api.post('/recommendations', {})

        expect(authorizationOf(seen[0])).toBe('Bearer token-abc')
        expect(authorizationOf(seen[1])).toBe('Bearer token-new')
    })

    it('sends no Authorization header when nobody is signed in', async () => {
        firebaseAuth.currentUser = null

        await api.post('/recommendations', {})

        expect(authorizationOf(seen[0])).toBeUndefined()
    })

    it('sends the token with the real recommendation helpers and a 30 s timeout', async () => {
        await fetchClarifier([{ role: 'user', content: 'cozy' }])
        await fetchRecommendations([{ role: 'user', content: 'cozy' }], 'uid-1')

        expect(RECOMMENDATION_TIMEOUT_MS).toBe(30_000)
        expect(seen.map((c) => c.url)).toEqual(['/recommendations/clarify', '/recommendations'])
        for (const config of seen) {
            expect(authorizationOf(config)).toBe('Bearer token-abc')
            expect(config.timeout).toBe(30_000)
        }
    })
})

describe('classifyApiError', () => {
    const httpError = (status: number) =>
        new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
            status,
            data: {},
            statusText: '',
            headers: {},
            config: { headers: {} as never }
        })

    it('maps 429 to quota and 401 to session', () => {
        expect(classifyApiError(httpError(429))).toBe('quota')
        expect(classifyApiError(httpError(401))).toBe('session')
    })

    it('maps everything else to generic', () => {
        expect(classifyApiError(httpError(500))).toBe('generic')
        expect(classifyApiError(httpError(503))).toBe('generic')
        expect(
            classifyApiError(new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED'))
        ).toBe('generic')
        expect(classifyApiError(new Error('boom'))).toBe('generic')
        expect(classifyApiError(undefined)).toBe('generic')
    })
})
