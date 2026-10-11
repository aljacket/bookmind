import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'

const { service } = vi.hoisted(() => ({
    service: { deleteAccount: vi.fn(), sendAccountPasswordReset: vi.fn() }
}))

vi.mock('@/services/account/deleteAccount', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/account/deleteAccount')>()),
    deleteAccount: service.deleteAccount,
    sendAccountPasswordReset: service.sendAccountPasswordReset
}))
vi.mock('@/services/firebase/config', () => ({ initAuth: () => ({}) }))

import { DeleteAccountError } from '@/services/account/deleteAccount'
import DeleteAccountDialog from '../DeleteAccountDialog.vue'

const EMAIL = 'reader@example.com'

let wrapper: VueWrapper
let appRoot: HTMLElement

const mountDialog = (locale = 'en') => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'uid-1', email: EMAIL } as never)
    const i18n = createI18n({
        legacy: false,
        locale,
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(DeleteAccountDialog, {
        attachTo: document.body,
        global: { plugins: [pinia, i18n] }
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

const typePassword = (value: string) => wrapper.find('#delete-account-password').setValue(value)
const submit = async () => {
    await wrapper.find('form').trigger('submit')
    await flushPromises()
}
const confirmButton = () => wrapper.find('button[type="submit"]')
const forgotButton = () =>
    wrapper.findAll('button').find((b) => b.text().startsWith(en.forgot_password))!
const errorBox = () => wrapper.find('[role="alert"]')
const resetStatus = () => wrapper.find('p[aria-live="polite"]:not(.sr-only)')
const setOnline = (online: boolean) =>
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online)

describe('DeleteAccountDialog', () => {
    beforeEach(() => {
        // jsdom has no layout, so no scrollIntoView.
        Element.prototype.scrollIntoView = vi.fn()
        appRoot = document.createElement('div')
        appRoot.id = 'app'
        document.body.appendChild(appRoot)
        service.deleteAccount.mockReset()
        service.sendAccountPasswordReset.mockReset().mockResolvedValue(undefined)
        setOnline(true)
    })

    afterEach(() => {
        wrapper?.unmount()
        appRoot.remove()
        vi.restoreAllMocks()
    })

    describe('content', () => {
        it('is a labelled modal dialog and makes the rest of the app inert while open', () => {
            mountDialog()
            const dialog = wrapper.find('[role="dialog"]')

            expect(dialog.attributes('aria-modal')).toBe('true')
            expect(dialog.attributes('aria-labelledby')).toBe('delete-account-title')
            expect(dialog.attributes('aria-describedby')).toBe('delete-account-lead')
            expect(wrapper.find('#delete-account-title').text()).toBe(en.delete_account_title)
            expect(wrapper.find('#delete-account-lead').text()).toBe(en.delete_account_lead)
            expect(appRoot.hasAttribute('inert')).toBe(true)

            wrapper.unmount()
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })

        it.each([
            ['en', en],
            ['it', it_],
            ['es', es]
        ])(
            'shows the approved %s copy, with provider and days from the shared constant',
            (locale, messages) => {
                mountDialog(locale)
                const text = wrapper.text()

                expect(wrapper.findAll('section')).toHaveLength(2)
                expect(wrapper.findAll('section')[0].findAll('li')).toHaveLength(2)
                expect(wrapper.findAll('section')[1].findAll('li')).toHaveLength(4)
                expect(text).toContain(messages.delete_account_deleted_heading)
                expect(text).toContain(messages.delete_account_kept_heading)
                expect(text).toContain(messages.delete_account_kept_counter)
                expect(text).toContain(
                    messages.delete_account_kept_ai
                        .replace('{provider}', 'OpenAI')
                        .replace('{days}', '30')
                )
                expect(text).toContain(messages.delete_account_kept_logs)
                expect(text).toContain(messages.delete_account_kept_other_devices)
                expect(text).toContain(EMAIL)
                expect(wrapper.find('label[for="delete-account-password"]').text()).toBe(
                    messages.delete_account_password_label
                )
                expect(confirmButton().text()).toBe(messages.delete_account_confirm)
            }
        )

        it('gives password managers the account email as a hidden username field', () => {
            mountDialog()
            const username = wrapper.find('input[autocomplete="username"]')

            expect((username.element as HTMLInputElement).value).toBe(EMAIL)
            expect(username.attributes('aria-hidden')).toBe('true')
            expect(username.attributes('tabindex')).toBe('-1')
        })

        it('puts focus on the title, not the password field', async () => {
            mountDialog()
            await flushPromises()

            expect(document.activeElement?.id).toBe('delete-account-title')
        })
    })

    describe('deleting', () => {
        it('an empty password shows a field error and sends nothing', async () => {
            mountDialog()
            await flushPromises() // let the initial focus on the title settle

            await submit()

            expect(service.deleteAccount).not.toHaveBeenCalled()
            expect(wrapper.text()).toContain(en.delete_account_error_empty)
            expect(wrapper.find('#delete-account-password').attributes('aria-invalid')).toBe('true')
            expect(document.activeElement?.id).toBe('delete-account-password')
        })

        it('a wrong password shows the field error, stays open and deletes nothing', async () => {
            service.deleteAccount.mockRejectedValue(new DeleteAccountError('wrong-password'))
            mountDialog()
            await typePassword('nope')

            await submit()

            expect(service.deleteAccount).toHaveBeenCalledWith('nope')
            expect(wrapper.text()).toContain(en.delete_account_error_wrong_password)
            expect(wrapper.emitted('deleted')).toBeUndefined()
            expect(wrapper.emitted('close')).toBeUndefined()
            // Back to an editable state, field value kept.
            expect(wrapper.find('#delete-account-password').attributes('disabled')).toBeUndefined()
            expect(
                (wrapper.find('#delete-account-password').element as HTMLInputElement).value
            ).toBe('nope')
        })

        it.each([
            ['too-many-attempts', 'delete_account_error_too_many'],
            ['network', 'delete_account_error_offline'],
            ['generic', 'delete_account_error_generic'],
            ['session', 'delete_account_error_session']
        ] as const)('a %s failure shows %s in the error box', async (kind, key) => {
            service.deleteAccount.mockRejectedValue(new DeleteAccountError(kind))
            mountDialog()
            await typePassword('pw')

            await submit()

            expect(errorBox().text()).toContain(en[key])
            expect(wrapper.emitted('deleted')).toBeUndefined()
        })

        it('a recent-login failure clears the field and asks for the password again', async () => {
            service.deleteAccount.mockRejectedValue(new DeleteAccountError('reauth-needed'))
            mountDialog()
            await typePassword('pw')

            await submit()

            expect(wrapper.text()).toContain(en.delete_account_error_reauth)
            expect(
                (wrapper.find('#delete-account-password').element as HTMLInputElement).value
            ).toBe('')
        })

        it('a lost session offers "Sign in again", which asks the parent to sign out', async () => {
            service.deleteAccount.mockRejectedValue(new DeleteAccountError('session'))
            mountDialog()
            await typePassword('pw')
            await submit()

            const action = errorBox()
                .findAll('button')
                .find((b) => b.text() === en.chat_error_session_action)!
            await action.trigger('click')

            expect(wrapper.emitted('sign-in-again')).toHaveLength(1)
        })

        it('offline: shows the offline message without calling the service, and clears it on reconnect', async () => {
            setOnline(false)
            mountDialog()
            await typePassword('pw')

            await submit()

            expect(service.deleteAccount).not.toHaveBeenCalled()
            expect(errorBox().text()).toContain(en.delete_account_error_offline)

            window.dispatchEvent(new Event('online'))
            await flushPromises()
            expect(errorBox().text()).toBe('')
        })

        it('while in progress every control is locked and Escape does not close', async () => {
            const pending = deferred()
            service.deleteAccount.mockReturnValue(pending.promise)
            mountDialog()
            await typePassword('pw')

            await submit()

            expect(wrapper.find('[role="dialog"]').attributes('aria-busy')).toBe('true')
            expect(wrapper.find('#delete-account-password').attributes('disabled')).toBeDefined()
            expect(forgotButton().attributes('disabled')).toBeDefined()
            expect(
                wrapper
                    .findAll('button[type="button"]')
                    .every((b) => b.attributes('disabled') !== undefined)
            ).toBe(true)
            expect(confirmButton().text()).toContain(en.delete_account_in_progress)
            expect(confirmButton().attributes('aria-disabled')).toBe('true')

            await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
            await wrapper.trigger('click')
            await confirmButton().trigger('click')
            expect(wrapper.emitted('close')).toBeUndefined()
            // A second submit while busy sends nothing.
            await wrapper.find('form').trigger('submit')
            expect(service.deleteAccount).toHaveBeenCalledTimes(1)

            pending.resolve()
            await flushPromises()
        })

        it('on success clears the auth store, releases the app and tells the parent', async () => {
            service.deleteAccount.mockResolvedValue({ uid: 'uid-1', wiped: true })
            mountDialog()
            await typePassword('pw')

            await submit()

            expect(wrapper.emitted('deleted')).toHaveLength(1)
            expect(useAuthStore().user).toBeNull()
            expect(appRoot.hasAttribute('inert')).toBe(false)
        })
    })

    describe('tight viewport (landscape phone with the keyboard open)', () => {
        const stubViewport = (height: number) => {
            vi.stubGlobal('visualViewport', {
                height,
                offsetTop: 0,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            })
        }
        afterEach(() => {
            vi.unstubAllGlobals()
        })

        it('stops being sticky when under 300 px are visible, and keeps the field and the actions in the DOM', () => {
            stubViewport(108)
            mountDialog()

            expect(wrapper.find('[role="dialog"]').classes()).toContain('dad-panel--tight')
            expect(wrapper.find('#delete-account-password').exists()).toBe(true)
            expect(confirmButton().exists()).toBe(true)
        })

        it('keeps the sticky layout at 336 px of visible height and above', () => {
            stubViewport(336)
            mountDialog()

            expect(wrapper.find('[role="dialog"]').classes()).not.toContain('dad-panel--tight')
        })

        it('scrolls the label to the top of what is left when the field gets focus', async () => {
            stubViewport(108)
            mountDialog()
            const calls: Array<[Element, unknown]> = []
            Element.prototype.scrollIntoView = function (this: Element, arg?: unknown) {
                calls.push([this, arg])
            }

            await wrapper.find('#delete-account-password').trigger('focus')

            expect(calls[0][1]).toEqual({ block: 'start' })
            expect(calls[0][0]).toBe(wrapper.find('label[for="delete-account-password"]').element)
        })
    })

    describe('closing', () => {
        it('Cancel, the close button and Escape close without side effects', async () => {
            mountDialog()
            await typePassword('secret')

            await wrapper.find('button[aria-label="Close"]').trigger('click')
            await wrapper
                .findAll('button')
                .find((b) => b.text() === en.delete_account_cancel)!
                .trigger('click')
            await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })

            expect(wrapper.emitted('close')).toHaveLength(3)
            expect(service.deleteAccount).not.toHaveBeenCalled()
            expect(service.sendAccountPasswordReset).not.toHaveBeenCalled()
            expect(appRoot.hasAttribute('inert')).toBe(false)
            expect(
                (wrapper.find('#delete-account-password').element as HTMLInputElement).value
            ).toBe('')
        })
    })

    describe('trapping focus', () => {
        it('wraps Tab from the last control to the first and Shift+Tab back', async () => {
            mountDialog()
            await flushPromises() // let the initial focus on the title settle
            const cancel = wrapper
                .findAll('button')
                .find((b) => b.text() === en.delete_account_cancel)!
            const close = wrapper.find('button[aria-label="Close"]')

            ;(cancel.element as HTMLElement).focus()
            await cancel.trigger('keydown', { key: 'Tab' })
            expect(document.activeElement).toBe(close.element)

            await close.trigger('keydown', { key: 'Tab', shiftKey: true })
            expect(document.activeElement).toBe(cancel.element)
        })
    })

    describe('forgot password', () => {
        it('sends one reset email to the account address, stays open and deletes nothing', async () => {
            mountDialog()

            await forgotButton().trigger('click')
            await flushPromises()

            expect(service.sendAccountPasswordReset).toHaveBeenCalledOnce()
            expect(service.sendAccountPasswordReset).toHaveBeenCalledWith(EMAIL)
            expect(resetStatus().text()).toBe(
                en.delete_account_reset_sent.replace('{email}', EMAIL)
            )
            expect(service.deleteAccount).not.toHaveBeenCalled()
            expect(wrapper.emitted('close')).toBeUndefined()
            expect(wrapper.emitted('deleted')).toBeUndefined()
            // Neither the password field nor the deletion error box are touched.
            expect(errorBox().text()).toBe('')
            expect(wrapper.find('#delete-account-field-error').exists()).toBe(false)
            expect(forgotButton().attributes('disabled')).toBeUndefined()
        })

        it('while the request is in flight the link is disabled and a second tap sends nothing', async () => {
            const pending = deferred()
            service.sendAccountPasswordReset.mockReturnValue(pending.promise)
            mountDialog()

            await forgotButton().trigger('click')
            expect(forgotButton().attributes('disabled')).toBeDefined()
            expect(forgotButton().attributes('aria-busy')).toBe('true')
            expect(forgotButton().find('svg').exists()).toBe(true)
            await forgotButton().trigger('click')

            expect(service.sendAccountPasswordReset).toHaveBeenCalledTimes(1)
            // The deletion controls stay usable while the reset is sending.
            expect(confirmButton().attributes('disabled')).toBeUndefined()

            pending.resolve()
            await flushPromises()
            expect(forgotButton().attributes('disabled')).toBeUndefined()
        })

        it('offline: shows the error and sends no request', async () => {
            setOnline(false)
            mountDialog()

            await forgotButton().trigger('click')
            await flushPromises()

            expect(service.sendAccountPasswordReset).not.toHaveBeenCalled()
            expect(resetStatus().text()).toBe(en.delete_account_reset_error)
            expect(service.deleteAccount).not.toHaveBeenCalled()
        })

        it('a failed request shows the error and re-enables the link; a later success replaces it', async () => {
            const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
            service.sendAccountPasswordReset.mockRejectedValueOnce(new Error('blocked'))
            mountDialog()

            await forgotButton().trigger('click')
            await flushPromises()
            expect(resetStatus().text()).toBe(en.delete_account_reset_error)
            expect(forgotButton().attributes('disabled')).toBeUndefined()
            expect(service.deleteAccount).not.toHaveBeenCalled()

            await forgotButton().trigger('click')
            await flushPromises()
            expect(resetStatus().text()).toContain(EMAIL)
            expect(resetStatus().text()).not.toContain(en.delete_account_reset_error)
            errorLog.mockRestore()
        })

        it('does not replace a deletion error, and a deletion error does not replace the reset status', async () => {
            service.deleteAccount.mockRejectedValue(new DeleteAccountError('wrong-password'))
            mountDialog()
            await forgotButton().trigger('click')
            await flushPromises()

            await typePassword('nope')
            await submit()

            expect(resetStatus().text()).toContain(EMAIL)
            expect(wrapper.text()).toContain(en.delete_account_error_wrong_password)
        })

        it('ignores a reset still in flight when the deletion succeeds', async () => {
            const pending = deferred()
            service.sendAccountPasswordReset.mockReturnValue(pending.promise)
            service.deleteAccount.mockResolvedValue({ uid: 'uid-1', wiped: true })
            mountDialog()
            await forgotButton().trigger('click')
            await typePassword('pw')
            await submit()

            pending.resolve()
            await flushPromises()

            expect(wrapper.emitted('deleted')).toHaveLength(1)
            expect(resetStatus().text()).toBe('')
        })
    })
})
