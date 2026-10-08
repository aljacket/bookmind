import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'
import { fetchClarifier, fetchRecommendations } from '@/services/recommendations/bookRecommendation'
import PreferencesPage from '../PreferencesPage.vue'

vi.mock('@/services/recommendations/bookRecommendation', () => ({
    fetchClarifier: vi.fn(),
    fetchRecommendations: vi.fn()
}))

const stub = { template: '<div />' }

const mountPage = async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'test-uid' })

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/processing', name: 'Processing', component: stub }
        ]
    })
    const pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })

    const wrapper = mount(PreferencesPage, {
        attachTo: document.body,
        global: {
            plugins: [router, pinia, i18n],
            stubs: { Header: true, AiTransparencyNote: true }
        }
    })
    await flushPromises()
    return { wrapper, pushSpy }
}

const send = async (wrapper, text) => {
    await wrapper.find('textarea').setValue(text)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}

const userBubbles = (wrapper) => wrapper.findAll('div.justify-end').map((node) => node.text())

const transcriptOf = (call) => call[0].map((turn) => turn.content)

describe('PreferencesPage send failures', () => {
    beforeEach(() => {
        vi.mocked(fetchClarifier).mockReset()
        vi.mocked(fetchRecommendations).mockReset()
        localStorage.clear()
    })

    it('resends the same transcript to /recommendations after a failure', async () => {
        vi.mocked(fetchClarifier).mockResolvedValue({ question: 'Long or short?' })
        vi.mocked(fetchRecommendations)
            .mockRejectedValueOnce(new Error('500'))
            .mockResolvedValueOnce([{ title: 'T', author: 'A', reason: 'R' }])
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper, pushSpy } = await mountPage()
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')
        await send(wrapper, 'long ones')

        // First attempt failed: error shown, turn rolled back, text restored and focused.
        expect(fetchRecommendations).toHaveBeenCalledTimes(1)
        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error)
        expect(wrapper.find('textarea').element.value).toBe('long ones')
        expect(document.activeElement).toBe(wrapper.find('textarea').element)
        expect(userBubbles(wrapper)).toEqual(['cozy', 'small towns'])
        expect(pushSpy).not.toHaveBeenCalled()

        // Sending again, unchanged, repeats the identical request.
        await wrapper.find('form').trigger('submit')
        await flushPromises()

        expect(fetchRecommendations).toHaveBeenCalledTimes(2)
        const [first, second] = vi.mocked(fetchRecommendations).mock.calls
        expect(transcriptOf(first)).toEqual(['cozy', 'small towns', 'long ones'])
        expect(transcriptOf(second)).toEqual(transcriptOf(first))
        expect(second[1]).toBe('test-uid')
        expect(pushSpy).toHaveBeenCalledWith({ name: 'Processing' })
        expect(wrapper.find('[role="alert"]').text()).toBe('')
        wrapper.unmount()
    })

    it('resends /clarify with exactly 2 turns after a failure', async () => {
        vi.mocked(fetchClarifier)
            .mockRejectedValueOnce(new Error('500'))
            .mockResolvedValueOnce({ question: 'Long or short?' })
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper } = await mountPage()
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')

        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error)
        expect(wrapper.find('textarea').element.value).toBe('small towns')
        expect(userBubbles(wrapper)).toEqual(['cozy'])
        // Turn is back at 1: the skip link is not offered, and /recommendations is not called.
        expect(wrapper.text()).not.toContain(en.chat_skip_clarifier)
        expect(fetchRecommendations).not.toHaveBeenCalled()

        await wrapper.find('form').trigger('submit')
        await flushPromises()

        expect(fetchClarifier).toHaveBeenCalledTimes(2)
        for (const call of vi.mocked(fetchClarifier).mock.calls) {
            expect(transcriptOf(call)).toEqual(['cozy', 'small towns'])
        }
        expect(wrapper.text()).toContain('Long or short?')
        expect(userBubbles(wrapper)).toEqual(['cozy', 'small towns'])
        expect(wrapper.text()).toContain(en.chat_skip_clarifier)
        wrapper.unmount()
    })

    it('keeps the skip link working after "Just show me the books" fails', async () => {
        vi.mocked(fetchClarifier).mockResolvedValue({ question: 'Long or short?' })
        vi.mocked(fetchRecommendations)
            .mockRejectedValueOnce(new Error('500'))
            .mockResolvedValueOnce([])
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper, pushSpy } = await mountPage()
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')

        const skip = () =>
            wrapper.findAll('button').find((b) => b.text() === en.chat_skip_clarifier)

        await skip().trigger('click')
        await flushPromises()
        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error)
        expect(skip()).toBeTruthy()
        expect(userBubbles(wrapper)).toEqual(['cozy', 'small towns'])

        await skip().trigger('click')
        await flushPromises()
        expect(fetchRecommendations).toHaveBeenCalledTimes(2)
        for (const call of vi.mocked(fetchRecommendations).mock.calls) {
            expect(transcriptOf(call)).toEqual(['cozy', 'small towns'])
        }
        expect(pushSpy).toHaveBeenCalledWith({ name: 'Processing' })
        wrapper.unmount()
    })
})
