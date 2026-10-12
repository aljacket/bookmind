import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'
import { fetchClarifier, fetchRecommendations } from '@/services/recommendations/bookRecommendation'
import { submitReport } from '@/services/reports/reportAiContent'
import PreferencesPage from '../PreferencesPage.vue'

vi.mock('@/services/recommendations/bookRecommendation', () => ({
    fetchClarifier: vi.fn(),
    fetchRecommendations: vi.fn()
}))
vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: vi.fn()
}))
vi.mock('@/services/firebase/config', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

const stub = { template: '<div />' }
const QUESTION = 'Do you prefer long or short books?'

let wrapper: VueWrapper
let pushSpy: { mock: { calls: unknown[][] } }

const mountPage = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'test-uid' } as never)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/processing', name: 'Processing', component: stub },
            { path: '/login', name: 'Login', component: stub }
        ]
    })
    pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(PreferencesPage, {
        attachTo: document.body,
        global: {
            plugins: [router, pinia, i18n],
            stubs: { Header: true, AiTransparencyNote: true }
        }
    })
    await flushPromises()
}

const send = async (text: string) => {
    await wrapper.find('textarea').setValue(text)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}

const reportButtons = () => wrapper.findAll('button[aria-haspopup="dialog"]')

describe('PreferencesPage: reporting the clarifier question', () => {
    beforeEach(() => {
        vi.mocked(fetchClarifier).mockReset().mockResolvedValue({ question: QUESTION })
        vi.mocked(fetchRecommendations).mockReset()
        vi.mocked(submitReport).mockReset().mockResolvedValue(undefined)
        localStorage.clear()
    })

    afterEach(() => {
        wrapper?.unmount()
        document.body.replaceChildren()
    })

    it('offers no action on the opener, the anchor prompt or the user bubbles', async () => {
        await mountPage()
        expect(reportButtons()).toHaveLength(0)

        await send('cozy')

        // Opener, user bubble and anchor prompt: no AI-written text yet.
        expect(wrapper.findAll('[aria-live="polite"] > div').length).toBeGreaterThanOrEqual(3)
        expect(reportButtons()).toHaveLength(0)
    })

    it('offers the action under the clarifier question only, and sends only that text', async () => {
        await mountPage()
        await send('cozy')
        await send('small towns')

        expect(reportButtons()).toHaveLength(1)
        const button = reportButtons()[0]
        expect(button.attributes('aria-label')).toBe(en.report_action_clarifier_aria)
        expect(button.text()).toBe(en.report_action)
        // It sits in the clarifier's row, right after its bubble.
        const row = button.element.closest('[aria-live="polite"] > div')!
        expect(row.classList.contains('flex-col')).toBe(true)
        expect(row.firstElementChild!.textContent!.trim()).toBe(QUESTION)

        await button.trigger('click')
        const sheet = document.body.querySelector('[role="dialog"]')!
        expect(sheet).not.toBeNull()
        ;(sheet.querySelector('input[value="offensive"]') as HTMLInputElement).click()
        await flushPromises()
        sheet.dispatchEvent(new Event('submit', { cancelable: true }))
        await flushPromises()

        expect(submitReport).toHaveBeenCalledTimes(1)
        const [target, reason] = vi.mocked(submitReport).mock.calls[0]
        expect(reason).toBe('offensive')
        // Only the AI question: neither of the user's messages, nor the opener or the anchor.
        expect(target).toMatchObject({ kind: 'clarifier', content: QUESTION })
        expect(JSON.stringify(target)).not.toContain('cozy')
        expect(JSON.stringify(target)).not.toContain('small towns')
        // The user stays on the chat.
        expect(pushSpy).not.toHaveBeenCalled()
        expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('disables the action while the recommendation request is in flight', async () => {
        let resolve!: (value: never[]) => void
        vi.mocked(fetchRecommendations).mockReturnValue(new Promise((res) => (resolve = res)))
        await mountPage()
        await send('cozy')
        await send('small towns')
        expect(reportButtons()[0].attributes('disabled')).toBeUndefined()

        await send('long ones')

        expect(fetchRecommendations).toHaveBeenCalledTimes(1)
        expect(reportButtons()[0].attributes('disabled')).toBeDefined()

        resolve([])
        await flushPromises()
    })
})
