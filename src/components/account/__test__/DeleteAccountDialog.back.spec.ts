import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'
import { useAuthStore } from '@/stores/auth'

const { service, plugin } = vi.hoisted(() => ({
    service: { deleteAccount: vi.fn(), sendAccountPasswordReset: vi.fn() },
    plugin: { addListener: vi.fn(), exitApp: vi.fn() }
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/app', () => ({
    App: { addListener: plugin.addListener, exitApp: plugin.exitApp }
}))
vi.mock('@/services/account/deleteAccount', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/account/deleteAccount')>()),
    deleteAccount: service.deleteAccount,
    sendAccountPasswordReset: service.sendAccountPasswordReset
}))
vi.mock('@/services/firebase/config', () => ({ initAuth: () => ({}) }))

import { installBackButtonHandling } from '@/services/backButton'
import DeleteAccountDialog from '../DeleteAccountDialog.vue'

let wrapper: VueWrapper
let onBack: (event: { canGoBack: boolean }) => void

const mountDialog = () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useAuthStore().setUser({ uid: 'uid-1', email: 'reader@example.com' } as never)
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(DeleteAccountDialog, {
        attachTo: document.body,
        global: { plugins: [pinia, i18n] }
    })
}

describe('DeleteAccountDialog: Android Back button', () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn()
        historyBack.mockClear()
        plugin.exitApp.mockReset().mockResolvedValue(undefined)
        if (!onBack) {
            plugin.addListener.mockResolvedValue({ remove: vi.fn() })
            installBackButtonHandling()
            onBack = plugin.addListener.mock.calls[0][1]
        }
        service.deleteAccount.mockReset()
    })

    afterEach(() => {
        wrapper?.unmount()
    })

    it('closes the idle dialog, like Escape, without deleting or navigating', () => {
        mountDialog()

        onBack({ canGoBack: true })

        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(service.deleteAccount).not.toHaveBeenCalled()
        expect(historyBack).not.toHaveBeenCalled()
        expect(plugin.exitApp).not.toHaveBeenCalled()
    })

    it('is ignored while the deletion is in progress (no close, no navigation, no exit), and works again after a failure', async () => {
        let reject!: (reason: unknown) => void
        service.deleteAccount.mockReturnValue(new Promise((_, rej) => (reject = rej)))
        mountDialog()
        await wrapper.find('#delete-account-password').setValue('pw')
        await wrapper.find('form').trigger('submit')

        onBack({ canGoBack: false })
        expect(wrapper.emitted('close')).toBeUndefined()
        expect(historyBack).not.toHaveBeenCalled()
        expect(plugin.exitApp).not.toHaveBeenCalled()

        const { DeleteAccountError } = await import('@/services/account/deleteAccount')
        reject(new DeleteAccountError('generic'))
        await flushPromises()

        onBack({ canGoBack: false })
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('once the dialog is gone, Back behaves as before again', () => {
        mountDialog()
        wrapper.unmount()

        onBack({ canGoBack: true })
        expect(historyBack).toHaveBeenCalledOnce()

        onBack({ canGoBack: false })
        expect(plugin.exitApp).toHaveBeenCalledOnce()
    })
})
