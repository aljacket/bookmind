import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'
import { getReadingList } from '@/services/indexedDB/userPreferences'
import { submitReport } from '@/services/reports/reportAiContent'
import type { BookRecommendation } from '@/types/userPreferences'
import ReadingListPage from '../ReadingListPage.vue'

vi.mock('@/services/indexedDB/userPreferences', () => ({
    getReadingList: vi.fn(),
    removeFromReadingList: vi.fn(),
    setReadingListItemStatus: vi.fn(),
    setReadingListItemLiked: vi.fn()
}))
vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: vi.fn()
}))
vi.mock('@/services/firebase/config', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

const stub = { template: '<div />' }

const LIST: BookRecommendation[] = [
    { title: 'Dune', author: 'Frank Herbert', reason: 'You said you like epic worlds.' },
    // Saved without an AI reason (for example from an older version): nothing AI-written to report.
    { title: 'Emma', author: 'Jane Austen' },
    { title: 'Ulysses', author: 'James Joyce', reason: '' }
]

let wrapper: VueWrapper

const mountPage = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'uid-1' } as never)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/login', name: 'Login', component: stub }
        ]
    })
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(ReadingListPage, {
        attachTo: document.body,
        global: { plugins: [router, pinia, i18n], stubs: { Header: true, Footer: true } }
    })
    await flushPromises()
}

const cards = () => wrapper.findAll('div.group')
const reportButtons = () => wrapper.findAll('button[aria-haspopup="dialog"]')

describe('ReadingListPage: reporting the AI reason', () => {
    beforeEach(() => {
        vi.mocked(getReadingList).mockReset().mockResolvedValue(LIST)
        vi.mocked(submitReport).mockReset().mockResolvedValue(undefined)
    })

    afterEach(() => {
        wrapper?.unmount()
        document.body.replaceChildren()
    })

    it('offers the action only on cards that show an AI reason', async () => {
        await mountPage()

        expect(cards()).toHaveLength(3)
        expect(cards().map((c) => c.findAll('button[aria-haspopup="dialog"]').length)).toEqual([
            1, 0, 0
        ])
        expect(reportButtons()[0].attributes('aria-label')).toBe(
            'Report the AI recommendation for Dune'
        )
    })

    it('places it directly under the reason', async () => {
        await mountPage()
        const reasonP = cards()[0]
            .findAll('p')
            .find((p) => p.classes().includes('italic'))!

        expect(reasonP.element.nextElementSibling).toBe(reportButtons()[0].element.parentElement)
        expect(reasonP.classes()).toContain('mb-1')
    })

    it('reports without leaving the reading list, and shows Reported afterwards', async () => {
        await mountPage()

        await reportButtons()[0].trigger('click')
        const sheet = document.body.querySelector('[role="dialog"]')!
        ;(sheet.querySelector('input[value="other"]') as HTMLInputElement).click()
        await flushPromises()
        sheet.dispatchEvent(new Event('submit', { cancelable: true }))
        await flushPromises()

        expect(submitReport).toHaveBeenCalledTimes(1)
        expect(vi.mocked(submitReport).mock.calls[0][0]).toMatchObject({
            kind: 'recommendation',
            content: 'Dune — Frank Herbert\nYou said you like epic worlds.'
        })
        expect(cards()).toHaveLength(3)
        expect(cards()[0].text()).toContain(en.report_done_inline)
    })
})
