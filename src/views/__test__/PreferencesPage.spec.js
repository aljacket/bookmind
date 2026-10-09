import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { AxiosError } from 'axios'
import { signOut } from 'firebase/auth'
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

vi.mock('@/services/firebase/config', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))

const httpError = (status) =>
    new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        status,
        data: {},
        headers: {},
        config: {}
    })

const stub = { template: '<div />' }

const mountPage = async (locale = 'en') => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'test-uid' })

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/processing', name: 'Processing', component: stub },
            { path: '/login', name: 'Login', component: stub }
        ]
    })
    const pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale,
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
        vi.mocked(signOut).mockClear()
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

    it.each([
        ['en', en],
        ['it', it_],
        ['es', es]
    ])('explains a 429 on /recommendations in %s and restores the turn', async (locale, messages) => {
        vi.mocked(fetchClarifier).mockResolvedValue({ question: 'Long or short?' })
        vi.mocked(fetchRecommendations).mockRejectedValue(httpError(429))
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper } = await mountPage(locale)
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')
        await send(wrapper, 'long ones')

        expect(wrapper.find('[role="alert"]').text()).toBe(messages.chat_error_quota)
        expect(messages.chat_error_quota).not.toBe(messages.chat_error)
        // Turn rolled back: the text is in the textarea, not in the log, and no sign-in action.
        expect(wrapper.find('textarea').element.value).toBe('long ones')
        expect(userBubbles(wrapper)).toEqual(['cozy', 'small towns'])
        expect(wrapper.find('[role="alert"] button').exists()).toBe(false)
        wrapper.unmount()
    })

    it('explains a 429 on /clarify and keeps the turn counter at 1', async () => {
        vi.mocked(fetchClarifier).mockRejectedValue(httpError(429))
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper } = await mountPage()
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')

        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error_quota)
        expect(wrapper.find('textarea').element.value).toBe('small towns')
        expect(userBubbles(wrapper)).toEqual(['cozy'])
        expect(wrapper.text()).not.toContain(en.chat_skip_clarifier)
        wrapper.unmount()
    })

    it.each([
        ['en', en],
        ['it', it_],
        ['es', es]
    ])('explains a 401 in %s, offers to sign in again and restores the turn', async (locale, messages) => {
        vi.mocked(fetchClarifier).mockRejectedValue(httpError(401))
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper, pushSpy } = await mountPage(locale)
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')

        const alert = wrapper.find('[role="alert"]')
        expect(alert.text()).toContain(messages.chat_error_session)
        expect(wrapper.find('textarea').element.value).toBe('small towns')
        expect(userBubbles(wrapper)).toEqual(['cozy'])

        const action = alert.find('button')
        expect(action.text()).toBe(messages.chat_error_session_action)
        await action.trigger('click')
        await flushPromises()
        expect(signOut).toHaveBeenCalledTimes(1)
        expect(useAuthStore().user).toBeNull()
        expect(pushSpy).toHaveBeenCalledWith('/login')
        wrapper.unmount()
    })

    it('keeps the generic message for 503 and for non-HTTP failures', async () => {
        vi.mocked(fetchClarifier)
            .mockRejectedValueOnce(httpError(503))
            .mockRejectedValueOnce(new Error('timeout'))
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const { wrapper } = await mountPage()
        await send(wrapper, 'cozy')
        await send(wrapper, 'small towns')
        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error)
        await wrapper.find('form').trigger('submit')
        await flushPromises()
        expect(wrapper.find('[role="alert"]').text()).toBe(en.chat_error)
        expect(wrapper.find('[role="alert"] button').exists()).toBe(false)
        wrapper.unmount()
    })
})
