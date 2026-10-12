import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'

const { service } = vi.hoisted(() => ({ service: { submitReport: vi.fn() } }))

vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: service.submitReport
}))

import {
    ReportError,
    clarifierTarget,
    recommendationTarget,
    type ReportTarget
} from '@/services/reports/reportAiContent'
import ReportAiContentSheet from '../ReportAiContentSheet.vue'

let wrapper: VueWrapper
let appRoot: HTMLElement

const mountSheet = (
    target: ReportTarget = clarifierTarget('Which mood do you want?'),
    locale = 'en'
) => {
    const i18n = createI18n({
        legacy: false,
        locale,
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(ReportAiContentSheet, {
        attachTo: document.body,
        props: { target },
        global: { plugins: [i18n] }
    })
    return wrapper
}

const deferred = <T = void>() => {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const radios = () => wrapper.findAll('input[type="radio"]')
const pick = (value: string) => wrapper.find(`input[type="radio"][value="${value}"]`).setValue(true)
const sendButton = () => wrapper.find('button[type="submit"]')
const buttonByText = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)
const closeX = () => wrapper.find('button[aria-label="Close"]')
const errorBox = () => wrapper.find('[role="alert"]')
const submit = async () => {
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}
const setViewport = (matches: boolean) => {
    window.matchMedia = vi.fn().mockReturnValue({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    }) as never
}

describe('ReportAiContentSheet', () => {
    const originalMatchMedia = window.matchMedia

    beforeEach(() => {
        appRoot = document.createElement('div')
        appRoot.id = 'app'
        document.body.appendChild(appRoot)
        service.submitReport.mockReset().mockResolvedValue(undefined)
        window.matchMedia = originalMatchMedia
    })

    afterEach(() => {
        wrapper?.unmount()
        appRoot.remove()
        window.matchMedia = originalMatchMedia
    })

    describe('content and accessibility', () => {
        it('is a labelled modal dialog and makes the rest of the app inert while open', () => {
            mountSheet()
            const dialog = wrapper.find('[role="dialog"]')

            expect(dialog.attributes('aria-modal')).toBe('true')
            expect(dialog.attributes('aria-labelledby')).toBe('report-sheet-title')
            expect(dialog.attributes('aria-describedby')).toBe('report-sheet-quote')
            expect(wrapper.find('#report-sheet-title').text()).toBe(en.report_title_clarifier)
            expect(wrapper.find('#report-sheet-quote').text()).toBe('Which mood do you want?')
            expect(appRoot.hasAttribute('inert')).toBe(true)

            wrapper.unmount()
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })

        it('moves focus to the title on open', async () => {
            mountSheet()
            await flushPromises()

            expect(document.activeElement).toBe(wrapper.find('#report-sheet-title').element)
        })

        it('offers the three reasons in order, none preselected, and Send is disabled', () => {
            mountSheet()

            expect(radios().map((r) => r.attributes('value'))).toEqual([
                'offensive',
                'inaccurate',
                'other'
            ])
            expect(radios().every((r) => !(r.element as HTMLInputElement).checked)).toBe(true)
            expect(wrapper.find('fieldset legend').text()).toBe(en.report_reason_legend)
            expect(sendButton().attributes('disabled')).toBeDefined()
            expect(sendButton().text()).toBe(en.report_send)
            expect(wrapper.text()).toContain(en.report_privacy_note)
        })

        it('links every reason to its hint', () => {
            mountSheet()

            for (const radio of radios()) {
                const hint = wrapper.find(`#${radio.attributes('aria-describedby')}`)
                expect(hint.exists()).toBe(true)
            }
        })

        it('keeps the error box mounted and empty until there is an error', () => {
            mountSheet()

            expect(errorBox().exists()).toBe(true)
            expect(errorBox().text()).toBe('')
        })

        it('quotes the recommendation title, author and reason that will be sent', () => {
            mountSheet(
                recommendationTarget({
                    title: 'Dune',
                    author: 'Frank Herbert',
                    reason: 'Epic and political.'
                })
            )
            const quote = wrapper.find('#report-sheet-quote')

            expect(wrapper.find('#report-sheet-title').text()).toBe(en.report_title_recommendation)
            expect(quote.text()).toContain('Dune')
            expect(quote.text()).toContain('Frank Herbert')
            expect(quote.text()).toContain('Epic and political.')
        })

        it.each([
            ['en', en],
            ['it', it_],
            ['es', es]
        ])('shows the %s copy', (locale, messages) => {
            mountSheet(clarifierTarget('q'), locale)
            const text = wrapper.text()

            expect(text).toContain(messages.report_title_clarifier)
            expect(text).toContain(messages.report_reason_legend)
            expect(text).toContain(messages.report_reason_offensive)
            expect(text).toContain(messages.report_reason_inaccurate_hint)
            expect(text).toContain(messages.report_reason_other)
            expect(text).toContain(messages.report_privacy_note)
            expect(text).toContain(messages.report_send)
            expect(text).toContain(messages.report_cancel)
        })
    })

    describe('presentation', () => {
        it('is a bottom sheet on compact width or height', () => {
            setViewport(false)
            mountSheet()

            expect(wrapper.classes()).toContain('rs-root--sheet')
            expect(wrapper.find('.rs-panel').classes()).toContain('rs-panel--sheet')
        })

        it('is a centred dialog from 600 x 480 up', () => {
            setViewport(true)
            mountSheet()

            expect(wrapper.classes()).toContain('rs-root--centred')
            expect(wrapper.find('.rs-panel').classes()).toContain('rs-panel--centred')
        })
    })

    describe('sending', () => {
        it('sends the picked reason once and shows the sent state', async () => {
            const target = clarifierTarget('Which mood do you want?')
            mountSheet(target)
            await pick('inaccurate')
            expect(sendButton().attributes('disabled')).toBeUndefined()

            await submit()

            expect(service.submitReport).toHaveBeenCalledTimes(1)
            expect(service.submitReport).toHaveBeenCalledWith(target, 'inaccurate')
            expect(wrapper.emitted('reported')).toHaveLength(1)
            expect(wrapper.find('[role="status"]').exists()).toBe(true)
            expect(wrapper.find('#report-sheet-sent-title').text()).toBe(en.report_sent_title)
            expect(wrapper.text()).toContain(en.report_sent_body)
            expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe(
                'report-sheet-sent-title'
            )
            expect(document.activeElement).toBe(wrapper.find('#report-sheet-sent-title').element)
            expect(wrapper.find('fieldset').exists()).toBe(false)
            // Done is the only action, and it closes.
            expect(sendButton().exists()).toBe(false)
            await buttonByText(en.report_done)!.trigger('click')
            expect(wrapper.emitted('close')).toHaveLength(1)
        })

        it('does not send without a reason', async () => {
            mountSheet()

            await submit()

            expect(service.submitReport).not.toHaveBeenCalled()
        })

        it('sends only once with repeated taps, a double tap, or Enter while sending', async () => {
            const pending = deferred()
            service.submitReport.mockReturnValue(pending.promise)
            mountSheet()
            await pick('offensive')

            await sendButton().trigger('click')
            await sendButton().trigger('click')
            await wrapper.find('form').trigger('submit')
            await wrapper.find('form').trigger('submit')
            await wrapper
                .find('input[type="radio"][value="offensive"]')
                .trigger('keydown', { key: 'Enter' })
            await flushPromises()

            expect(service.submitReport).toHaveBeenCalledTimes(1)

            pending.resolve()
            await flushPromises()
            // Even after it finished, a late tap cannot send again.
            await wrapper.find('form').trigger('submit')
            expect(service.submitReport).toHaveBeenCalledTimes(1)
        })

        it('locks everything while sending and ignores Escape, the scrim and Back', async () => {
            const pending = deferred()
            service.submitReport.mockReturnValue(pending.promise)
            mountSheet()
            await pick('other')

            await submit()

            expect(sendButton().attributes('aria-disabled')).toBe('true')
            expect(sendButton().text()).toBe(en.report_sending)
            expect(wrapper.find('[role="dialog"]').attributes('aria-busy')).toBe('true')
            expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined()
            expect(buttonByText(en.report_cancel)!.attributes('disabled')).toBeDefined()
            expect(closeX().attributes('disabled')).toBeDefined()
            expect(wrapper.find('p[aria-live="polite"]').text()).toBe(en.report_sending)

            await wrapper.trigger('keydown', { key: 'Escape' })
            await wrapper.trigger('click')
            await wrapper.find('form').trigger('click')

            expect(wrapper.emitted('close')).toBeUndefined()

            pending.resolve()
            await flushPromises()
        })
    })

    describe('failures', () => {
        it.each([
            ['network', 'report_error_network'],
            ['generic', 'report_error_generic']
        ] as const)(
            'a %s error shows its message, keeps the reason and lets the user retry',
            async (kind, key) => {
                service.submitReport.mockRejectedValueOnce(new ReportError(kind))
                mountSheet()
                await pick('inaccurate')

                await submit()

                expect(errorBox().text()).toBe(en[key])
                expect(
                    (wrapper.find('input[value="inaccurate"]').element as HTMLInputElement).checked
                ).toBe(true)
                expect(sendButton().exists()).toBe(true)
                expect(sendButton().attributes('disabled')).toBeUndefined()
                expect(sendButton().text()).toBe(en.report_send)
                expect(buttonByText(en.report_cancel)).toBeDefined()
                expect(document.activeElement).toBe(sendButton().element)
                expect(wrapper.emitted('reported')).toBeUndefined()

                // Retry: the same Send button sends again, and this time it works.
                await submit()

                expect(service.submitReport).toHaveBeenCalledTimes(2)
                expect(wrapper.find('#report-sheet-sent-title').exists()).toBe(true)
            }
        )

        it('lets the user change the reason after an error', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('generic'))
            mountSheet()
            await pick('offensive')
            await submit()

            await pick('other')
            await submit()

            expect(service.submitReport).toHaveBeenLastCalledWith(expect.anything(), 'other')
        })

        it('treats an unexpected error as generic', async () => {
            service.submitReport.mockRejectedValueOnce(new Error('boom'))
            mountSheet()
            await pick('other')

            await submit()

            expect(errorBox().text()).toBe(en.report_error_generic)
        })

        it('429: shows the daily-limit message, removes Send and offers Close only', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('quota'))
            mountSheet()
            await pick('offensive')

            await submit()

            expect(errorBox().text()).toBe(en.report_error_quota)
            expect(sendButton().exists()).toBe(false)
            expect(buttonByText(en.report_cancel)).toBeUndefined()
            const close = buttonByText(en.report_close)!
            expect(document.activeElement).toBe(close.element)
            expect(wrapper.find('button[type="submit"]').exists()).toBe(false)

            await submit()
            expect(service.submitReport).toHaveBeenCalledTimes(1)

            await close.trigger('click')
            expect(wrapper.emitted('close')).toHaveLength(1)
        })

        it('401: shows the session message with "Sign in again", removes Send, and never retries', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('session'))
            mountSheet()
            await pick('other')

            await submit()

            expect(errorBox().text()).toContain(en.report_error_session)
            expect(sendButton().exists()).toBe(false)
            const action = buttonByText(en.chat_error_session_action)!
            expect(document.activeElement).toBe(action.element)
            expect(buttonByText(en.report_close)).toBeDefined()

            await submit()
            expect(service.submitReport).toHaveBeenCalledTimes(1)

            appRoot.setAttribute('inert', '')
            await action.trigger('click')
            expect(wrapper.emitted('sign-in-again')).toHaveLength(1)
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })

        it('shows each error in the active language', async () => {
            service.submitReport.mockRejectedValueOnce(new ReportError('network'))
            mountSheet(clarifierTarget('q'), 'it')
            await pick('other')

            await submit()

            expect(errorBox().text()).toBe(it_.report_error_network)
        })
    })

    describe('closing', () => {
        it.each([
            ['Cancel', () => buttonByText(en.report_cancel)!.trigger('click')],
            ['the x button', () => closeX().trigger('click')],
            ['Escape', () => wrapper.trigger('keydown', { key: 'Escape' })],
            ['the scrim', () => wrapper.trigger('click')]
        ])('%s closes without sending, and gives the app back', async (_label, act) => {
            mountSheet()
            await pick('other')
            expect(appRoot.hasAttribute('inert')).toBe(true)

            await act()

            expect(wrapper.emitted('close')).toHaveLength(1)
            expect(service.submitReport).not.toHaveBeenCalled()
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })

        it('a tap inside the panel does not count as a tap on the scrim', async () => {
            mountSheet()

            await wrapper.find('form').trigger('click')
            await wrapper.find('blockquote').trigger('click')

            expect(wrapper.emitted('close')).toBeUndefined()
        })

        it('traps Tab inside the sheet, wrapping in both directions', async () => {
            mountSheet()
            await pick('other')
            const focusable = wrapper
                .findAll('button:not(:disabled), input:not(:disabled)')
                .map((n) => n.element as HTMLElement)
            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            last.focus()
            await wrapper.trigger('keydown', { key: 'Tab' })
            expect(document.activeElement).toBe(first)

            first.focus()
            await wrapper.trigger('keydown', { key: 'Tab', shiftKey: true })
            expect(document.activeElement).toBe(last)
        })
    })
})
