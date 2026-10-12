import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { signOut } from 'firebase/auth'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'

const { service } = vi.hoisted(() => ({ service: { submitReport: vi.fn() } }))

vi.mock('@/services/firebase/config', () => ({ auth: { currentUser: null } }))
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: service.submitReport
}))

import {
    ReportError,
    clarifierTarget,
    recommendationTarget
} from '@/services/reports/reportAiContent'
import ReportAiContentButton from '../ReportAiContentButton.vue'
import ReportAiContentSheet from '../ReportAiContentSheet.vue'

const stub = { template: '<div />' }
const messagesByLocale = { en, it: it_, es }

let wrappers: VueWrapper[] = []
let appRoot: HTMLElement

const mountButton = (
    props: Record<string, unknown> = {},
    { locale = 'en', pinia = createPinia() }: { locale?: 'en' | 'it' | 'es'; pinia?: Pinia } = {}
) => {
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'uid-1' } as never)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: stub },
            { path: '/login', name: 'Login', component: stub }
        ]
    })
    const pushSpy = vi.spyOn(router, 'push')
    const i18n = createI18n({
        legacy: false,
        locale,
        fallbackLocale: 'en',
        messages: messagesByLocale
    })
    const wrapper = mount(ReportAiContentButton, {
        attachTo: appRoot,
        props: { target: clarifierTarget('Which mood do you want?'), ...props },
        global: { plugins: [router, pinia, i18n] }
    })
    wrappers.push(wrapper)
    return { wrapper, pushSpy, pinia }
}

const actionButton = (wrapper: VueWrapper) => wrapper.find('button[aria-haspopup="dialog"]')
const sheet = (wrapper: VueWrapper) => wrapper.findComponent(ReportAiContentSheet)
const sentReport = async (wrapper: VueWrapper) => {
    await actionButton(wrapper).trigger('click')
    await sheet(wrapper).find('input[value="other"]').setValue(true)
    await sheet(wrapper).find('form').trigger('submit')
    await flushPromises()
}

describe('ReportAiContentButton', () => {
    beforeEach(() => {
        appRoot = document.createElement('div')
        appRoot.id = 'app'
        document.body.appendChild(appRoot)
        service.submitReport.mockReset().mockResolvedValue(undefined)
        vi.mocked(signOut).mockClear()
    })

    afterEach(() => {
        wrappers.forEach((w) => w.unmount())
        wrappers = []
        appRoot.remove()
    })

    describe('the inline action', () => {
        it('shows the flag and the word Report, in a hit box of at least 44 x 44 px', () => {
            const { wrapper } = mountButton()
            const button = actionButton(wrapper)

            expect(button.text()).toBe(en.report_action)
            expect(button.find('svg').attributes('aria-hidden')).toBe('true')
            expect(button.classes()).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']))
            expect(button.attributes('type')).toBe('button')
            expect(button.attributes('aria-haspopup')).toBe('dialog')
        })

        it('has an accessible name that says what is reported: the clarifier question', () => {
            const { wrapper } = mountButton()

            expect(actionButton(wrapper).attributes('aria-label')).toBe(
                en.report_action_clarifier_aria
            )
        })

        it('has an accessible name that says what is reported: the recommendation, by title', () => {
            const { wrapper } = mountButton({
                target: recommendationTarget({ title: 'Dune', author: 'Frank Herbert' }),
                bookTitle: 'Dune (Penguin edition)'
            })

            expect(actionButton(wrapper).attributes('aria-label')).toBe(
                'Report the AI recommendation for Dune (Penguin edition)'
            )
        })

        it('names the reported title when the card gives none', () => {
            const { wrapper } = mountButton({
                target: recommendationTarget({ title: 'Dune', author: 'Frank Herbert' })
            })

            expect(actionButton(wrapper).attributes('aria-label')).toBe(
                'Report the AI recommendation for Dune'
            )
        })

        it.each(['en', 'it', 'es'] as const)(
            'the %s accessible names start with the visible label (WCAG 2.5.3)',
            (locale) => {
                const messages = messagesByLocale[locale]
                const clarifier = mountButton({}, { locale })
                const recommendation = mountButton(
                    { target: recommendationTarget({ title: 'Dune', author: 'F. Herbert' }) },
                    { locale }
                )

                for (const { wrapper } of [clarifier, recommendation]) {
                    const visible = actionButton(wrapper).text()
                    expect(visible).toBe(messages.report_action)
                    expect(
                        actionButton(wrapper).attributes('aria-label')!.startsWith(visible)
                    ).toBe(true)
                }
                expect(actionButton(clarifier.wrapper).attributes('aria-label')).toBe(
                    messages.report_action_clarifier_aria
                )
                expect(actionButton(recommendation.wrapper).attributes('aria-label')).toContain(
                    'Dune'
                )
            }
        )

        it('is disabled while the chat is waiting for a reply', async () => {
            const { wrapper } = mountButton({ disabled: true })

            expect(actionButton(wrapper).attributes('disabled')).toBeDefined()
            await actionButton(wrapper).trigger('click')

            expect(sheet(wrapper).exists()).toBe(false)
        })
    })

    describe('the sheet', () => {
        it('opens in place, on the same page, without navigating', async () => {
            const { wrapper, pushSpy } = mountButton()
            const before = window.location.href

            await actionButton(wrapper).trigger('click')

            expect(sheet(wrapper).exists()).toBe(true)
            expect(pushSpy).not.toHaveBeenCalled()
            expect(window.location.href).toBe(before)
        })

        it('returns focus to the Report button when it is cancelled', async () => {
            const { wrapper } = mountButton()
            await actionButton(wrapper).trigger('click')

            await sheet(wrapper).find('button.rs-btn--secondary').trigger('click')
            await flushPromises()

            expect(sheet(wrapper).exists()).toBe(false)
            expect(document.activeElement).toBe(actionButton(wrapper).element)
        })

        it('after a report: the action becomes a "Reported" marker that takes focus', async () => {
            const target = recommendationTarget({ title: 'Dune', author: 'Frank Herbert' })
            const { wrapper } = mountButton({ target })

            await sentReport(wrapper)
            // The marker is already there under the sheet, and the sheet shows "Report sent".
            expect(sheet(wrapper).find('#report-sheet-sent-title').exists()).toBe(true)
            await sheet(wrapper).find('button.rs-btn--primary').trigger('click')
            await flushPromises()

            expect(service.submitReport).toHaveBeenCalledTimes(1)
            expect(actionButton(wrapper).exists()).toBe(false)
            const marker = wrapper.find('span[tabindex="-1"]')
            expect(marker.text()).toBe(en.report_done_inline)
            expect(marker.classes()).toContain('min-h-11')
            expect(document.activeElement).toBe(marker.element)
            // Not interactive: it cannot be reported twice.
            expect(wrapper.find('button').exists()).toBe(false)
        })

        it('shares "Reported" between every place that shows the same text, in this session', async () => {
            const pinia = createPinia()
            const target = recommendationTarget({ title: 'Dune', author: 'Frank Herbert' })
            const home = mountButton({ target }, { pinia })
            const readingList = mountButton(
                { target: recommendationTarget({ title: 'Dune', author: 'Frank Herbert' }) },
                { pinia }
            )
            const other = mountButton(
                { target: recommendationTarget({ title: 'Emma', author: 'Jane Austen' }) },
                { pinia }
            )

            await sentReport(home.wrapper)
            await flushPromises()

            expect(readingList.wrapper.find('span[tabindex="-1"]').exists()).toBe(true)
            expect(actionButton(other.wrapper).exists()).toBe(true)
        })

        it('forgets what was reported when the signed-in user changes or signs out', async () => {
            const pinia = createPinia()
            const { wrapper } = mountButton({}, { pinia })
            await sentReport(wrapper)
            await sheet(wrapper).find('button.rs-btn--primary').trigger('click')
            await flushPromises()
            expect(wrapper.find('span[tabindex="-1"]').exists()).toBe(true)

            useAuthStore().setUser({ uid: 'uid-2' } as never)
            await flushPromises()

            expect(wrapper.find('span[tabindex="-1"]').exists()).toBe(false)
            expect(actionButton(wrapper).exists()).toBe(true)

            await sentReport(wrapper)
            await sheet(wrapper).find('button.rs-btn--primary').trigger('click')
            await flushPromises()
            expect(wrapper.find('span[tabindex="-1"]').exists()).toBe(true)
            useAuthStore().clearUser()
            await flushPromises()

            expect(actionButton(wrapper).exists()).toBe(true)
        })

        it('does not mark the item as reported when the report fails', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('generic'))
            const { wrapper } = mountButton()

            await sentReport(wrapper)

            expect(wrapper.find('span[tabindex="-1"]').exists()).toBe(false)
            expect(actionButton(wrapper).exists()).toBe(true)
        })

        it('401: "Sign in again" closes the sheet, signs out and opens /login', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('session'))
            const { wrapper, pushSpy } = mountButton()
            await sentReport(wrapper)

            const action = sheet(wrapper)
                .findAll('button')
                .find((b) => b.text() === en.chat_error_session_action)!
            await action.trigger('click')
            await flushPromises()

            expect(sheet(wrapper).exists()).toBe(false)
            expect(signOut).toHaveBeenCalledTimes(1)
            expect(useAuthStore().user).toBeNull()
            expect(pushSpy).toHaveBeenCalledWith('/login')
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })
    })
})
