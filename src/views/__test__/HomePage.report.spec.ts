import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'
import { getLastRecommendations, getReadingList } from '@/services/indexedDB/userPreferences'
import { submitReport } from '@/services/reports/reportAiContent'
import type { BookRecommendation } from '@/types/userPreferences'
import HomePage from '../HomePage.vue'

vi.mock('@/services/indexedDB/userPreferences', () => ({
    getLastRecommendations: vi.fn(),
    getReadingList: vi.fn(),
    saveLastRecommendations: vi.fn(),
    addToReadingList: vi.fn(),
    removeFromReadingList: vi.fn()
}))
vi.mock('@/services/googleBooks/googleBooksApi', () => ({ getBookDetails: vi.fn() }))
vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: vi.fn()
}))
vi.mock('@/services/firebase/config', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

const stub = { template: '<div />' }

const RECOMMENDATIONS: BookRecommendation[] = [
    {
        title: 'Dune (Ace edition)',
        author: 'Frank Herbert',
        reason: 'You said you like epic worlds.',
        fullRecommendation: JSON.stringify({
            title: 'Dune',
            author: 'Frank Herbert',
            reason: 'You said you like epic worlds.'
        })
    },
    { title: 'Emma', author: 'Jane Austen', reason: '' },
    { title: 'Ulysses', author: 'James Joyce', reason: 'A dense, rewarding read.' }
]

let wrapper: VueWrapper
let pushSpy: { mock: { calls: unknown[][] } }

const mountPage = async (locale = 'en') => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'uid-1', displayName: 'Ada' } as never)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/preferences', component: stub },
            { path: '/login', name: 'Login', component: stub }
        ]
    })
    pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale,
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(HomePage, {
        attachTo: document.body,
        global: { plugins: [router, pinia, i18n], stubs: { Header: true, Footer: true } }
    })
    await flushPromises()
}

const cards = () => wrapper.findAll('div.group')
const reportButtons = () => wrapper.findAll('button[aria-haspopup="dialog"]')

describe('HomePage: reporting recommendations', () => {
    beforeEach(() => {
        vi.mocked(getLastRecommendations).mockReset().mockResolvedValue(RECOMMENDATIONS)
        vi.mocked(getReadingList).mockReset().mockResolvedValue([])
        vi.mocked(submitReport).mockReset().mockResolvedValue(undefined)
    })

    afterEach(() => {
        wrapper?.unmount()
        document.body.replaceChildren()
    })

    it('puts the action on every card, also on one without a reason', async () => {
        await mountPage()

        expect(cards()).toHaveLength(3)
        for (const card of cards()) {
            expect(card.findAll('button[aria-haspopup="dialog"]')).toHaveLength(1)
        }
    })

    it('names what is reported by the book title shown on the card', async () => {
        await mountPage()

        expect(reportButtons().map((b) => b.attributes('aria-label'))).toEqual([
            'Report the AI recommendation for Dune (Ace edition)',
            'Report the AI recommendation for Emma',
            'Report the AI recommendation for Ulysses'
        ])
    })

    it('places it directly under the reason, or under the author when there is no reason', async () => {
        await mountPage()
        const [withReason, withoutReason] = cards()

        const reasonP = withReason.findAll('p').find((p) => p.classes().includes('italic'))!
        expect(reasonP.element.nextElementSibling).toBe(
            withReason.find('button[aria-haspopup="dialog"]').element.parentElement
        )
        const authorP = withoutReason.findAll('p').find((p) => p.text() === 'Jane Austen')!
        expect(authorP.element.nextElementSibling).toBe(
            withoutReason.find('button[aria-haspopup="dialog"]').element.parentElement
        )
        // 4 px below the AI text, 12 px above what follows.
        expect(reasonP.classes()).toContain('mb-1')
        expect(authorP.classes()).toContain('mb-1')
        expect(
            withReason
                .findAll('p')
                .find((p) => p.text() === 'Frank Herbert')!
                .classes()
        ).toContain('mb-4')
    })

    it("sends the model's own title, author and reason, stays on Home, then shows Reported", async () => {
        await mountPage()

        await reportButtons()[0].trigger('click')
        const sheet = document.body.querySelector('[role="dialog"]')!
        ;(sheet.querySelector('input[value="inaccurate"]') as HTMLInputElement).click()
        await flushPromises()
        sheet.dispatchEvent(new Event('submit', { cancelable: true }))
        await flushPromises()

        expect(submitReport).toHaveBeenCalledTimes(1)
        const [target, reason] = vi.mocked(submitReport).mock.calls[0]
        expect(reason).toBe('inaccurate')
        expect(target).toMatchObject({
            kind: 'recommendation',
            content: 'Dune — Frank Herbert\nYou said you like epic worlds.'
        })
        expect(pushSpy).not.toHaveBeenCalled()
        expect(wrapper.findAll('h3')).toHaveLength(3)

        // The other cards keep their action.
        expect(reportButtons()).toHaveLength(2)
        expect(cards()[0].text()).toContain(en.report_done_inline)
    })

    it('shows the action in the active language', async () => {
        await mountPage('it')

        expect(reportButtons()[2].text()).toBe(it_.report_action)
        expect(reportButtons()[2].attributes('aria-label')).toBe(
            "Segnala il consiglio dell'IA su Ulysses"
        )
    })
})
