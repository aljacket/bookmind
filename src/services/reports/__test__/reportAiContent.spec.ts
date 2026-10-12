import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import api from '@/services/api/axios'
import { useLanguageStore } from '@/stores/language'
import {
    ReportError,
    clarifierTarget,
    recommendationTarget,
    reportKey,
    submitReport
} from '../reportAiContent'

// Replaces the network: records every request config and answers like the backend, or fails.
let seen: AxiosRequestConfig[] = []
let respond: (config: AxiosRequestConfig) => Promise<unknown>
api.defaults.adapter = async (config) => {
    seen.push(config)
    return (await respond(config)) as never
}
const noContent = async (config: AxiosRequestConfig) => ({
    data: '',
    status: 204,
    statusText: 'No Content',
    headers: {},
    config
})
const httpError = (status: number) => async (config: AxiosRequestConfig) => {
    throw new AxiosError('failed', 'ERR_BAD_REQUEST', config as never, undefined, {
        status,
        data: {},
        statusText: '',
        headers: {},
        config: { headers: {} as never }
    })
}
const noResponse = (code: string) => async (config: AxiosRequestConfig) => {
    throw new AxiosError('no response', code, config as never)
}

const setOnline = (online: boolean) =>
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online)

const captured = async (promise: Promise<unknown>) => {
    try {
        await promise
    } catch (error) {
        return error
    }
    return undefined
}

describe('submitReport', () => {
    beforeEach(() => {
        seen = []
        respond = noContent
        getIdToken.mockReset().mockResolvedValue('token-abc')
        firebaseAuth.currentUser = { getIdToken }
        setActivePinia(createPinia())
        useLanguageStore().setLanguage('it')
        setOnline(true)
        // The api client logs every failed call; the failures here are expected.
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('posts exactly kind, lang, content and reason to /reports, with the ID token', async () => {
        const target = clarifierTarget('Che tipo di atmosfera cerchi?')

        await submitReport(target, 'offensive')

        expect(seen).toHaveLength(1)
        expect(seen[0].method).toBe('post')
        expect(seen[0].url).toBe('/reports')
        expect(JSON.parse(seen[0].data as string)).toEqual({
            kind: 'clarifier',
            lang: 'it',
            content: 'Che tipo di atmosfera cerchi?',
            reason: 'offensive'
        })
        const headers = seen[0].headers as unknown as { get(name: string): string | undefined }
        expect(headers.get('Authorization')).toBe('Bearer token-abc')
        // The endpoint does not call the LLM: the client's default 10 s timeout applies.
        expect(seen[0].timeout).toBe(10000)
    })

    it('uses the language selected at send time', async () => {
        useLanguageStore().setLanguage('es')

        await submitReport(clarifierTarget('¿Qué buscas?'), 'other')

        expect(JSON.parse(seen[0].data as string).lang).toBe('es')
    })

    it('never leaves the app: no navigation and no new window', async () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null)
        const before = window.location.href

        await submitReport(
            recommendationTarget({ title: 'Dune', author: 'Frank Herbert' }),
            'other'
        )

        expect(open).not.toHaveBeenCalled()
        expect(window.location.href).toBe(before)
    })

    it('fails offline at once, as a network error, without sending a request', async () => {
        setOnline(false)

        const error = await captured(submitReport(clarifierTarget('q'), 'other'))

        expect(error).toBeInstanceOf(ReportError)
        expect((error as ReportError).kind).toBe('network')
        expect(seen).toHaveLength(0)
    })

    it.each([
        ['429 is the daily limit', httpError(429), 'quota'],
        ['401 is an expired session', httpError(401), 'session'],
        ['no response (network error)', noResponse('ERR_NETWORK'), 'network'],
        ['no response (timeout)', noResponse('ECONNABORTED'), 'network'],
        ['no response (ETIMEDOUT)', noResponse('ETIMEDOUT'), 'network'],
        ['503 is generic', httpError(503), 'generic'],
        ['500 is generic', httpError(500), 'generic'],
        ['422 is generic', httpError(422), 'generic'],
        ['an unexpected error is generic', async () => Promise.reject(new Error('boom')), 'generic']
    ])('%s -> %s', async (_label, behaviour, kind) => {
        respond = behaviour

        const error = await captured(submitReport(clarifierTarget('q'), 'inaccurate'))

        expect(error).toBeInstanceOf(ReportError)
        expect((error as ReportError).kind).toBe(kind)
        expect(seen).toHaveLength(1)
    })
})

describe('report targets', () => {
    it('sends the clarifier question trimmed, as the only content', () => {
        const target = clarifierTarget('  Preferisci storie brevi o lunghe?  \n')

        expect(target).toEqual({
            kind: 'clarifier',
            content: 'Preferisci storie brevi o lunghe?',
            text: 'Preferisci storie brevi o lunghe?'
        })
    })

    it("sends the model's own title, author and reason from fullRecommendation", () => {
        const target = recommendationTarget({
            // Google Books corrected the card's title since the model wrote it.
            title: 'The Left Hand of Darkness (Ace Books)',
            author: 'Ursula Le Guin',
            reason: 'card reason',
            fullRecommendation: JSON.stringify({
                title: 'The Left Hand of Darkness',
                author: 'Ursula K. Le Guin',
                reason: 'You said you love quiet worlds.'
            })
        })

        expect(target.kind).toBe('recommendation')
        expect(target.content).toBe(
            'The Left Hand of Darkness — Ursula K. Le Guin\nYou said you love quiet worlds.'
        )
        expect(target.title).toBe('The Left Hand of Darkness')
        expect(target.author).toBe('Ursula K. Le Guin')
        expect(target.text).toBe('You said you love quiet worlds.')
    })

    it('falls back to the card fields when fullRecommendation is missing or not JSON', () => {
        const card = { title: 'Dune', author: 'Frank Herbert', reason: 'Epic and political.' }

        expect(recommendationTarget(card).content).toBe('Dune — Frank Herbert\nEpic and political.')
        expect(recommendationTarget({ ...card, fullRecommendation: 'not json' }).content).toBe(
            'Dune — Frank Herbert\nEpic and political.'
        )
        expect(recommendationTarget({ ...card, fullRecommendation: '{"foo":1}' }).content).toBe(
            'Dune — Frank Herbert\nEpic and political.'
        )
    })

    it('omits the reason line when there is none', () => {
        const target = recommendationTarget({ title: 'Dune', author: 'Frank Herbert' })

        expect(target.content).toBe('Dune — Frank Herbert')
        expect(target.text).toBe('')
    })

    it('cuts content longer than 1000 characters to 999 plus an ellipsis', () => {
        const long = 'a'.repeat(1500)

        const clarifier = clarifierTarget(long)
        const recommendation = recommendationTarget({
            title: 'Dune',
            author: 'Frank Herbert',
            reason: long
        })

        for (const target of [clarifier, recommendation]) {
            expect(target.content).toHaveLength(1000)
            expect(target.content.endsWith('…')).toBe(true)
        }
        expect(clarifierTarget('a'.repeat(1000)).content).toHaveLength(1000)
        expect(clarifierTarget('a'.repeat(1000)).content.endsWith('…')).toBe(false)
    })

    it('keys an item by kind and the exact content sent', () => {
        expect(reportKey(clarifierTarget('x'))).toBe(reportKey(clarifierTarget(' x ')))
        expect(reportKey({ kind: 'clarifier', content: 'x' })).not.toBe(
            reportKey({ kind: 'recommendation', content: 'x' })
        )
    })
})
