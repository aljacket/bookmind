import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const { native, plugin } = vi.hoisted(() => ({
    native: { value: true },
    plugin: { addListener: vi.fn(), exitApp: vi.fn() }
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('@capacitor/app', () => ({
    App: { addListener: plugin.addListener, exitApp: plugin.exitApp }
}))

describe('services/backButton', () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    // The module keeps module-level state (interceptors, installed): load a fresh copy per test.
    const load = async () => {
        vi.resetModules()
        return await import('../backButton')
    }

    beforeEach(() => {
        native.value = true
        historyBack.mockClear()
        plugin.exitApp.mockReset().mockResolvedValue(undefined)
        plugin.addListener.mockReset().mockResolvedValue({ remove: vi.fn() })
    })

    it('registers exactly one backButton listener, however often it is called', async () => {
        const { installBackButtonHandling } = await load()

        installBackButtonHandling()
        installBackButtonHandling()

        expect(plugin.addListener).toHaveBeenCalledOnce()
        expect(plugin.addListener.mock.calls[0][0]).toBe('backButton')
    })

    it('registers nothing on the web', async () => {
        native.value = false
        const { installBackButtonHandling } = await load()

        installBackButtonHandling()

        expect(plugin.addListener).not.toHaveBeenCalled()
    })

    it('keeps the old default: Back leaves the app, whatever the history says', async () => {
        const { installBackButtonHandling } = await load()
        installBackButtonHandling()
        const onBack = plugin.addListener.mock.calls[0][1]

        onBack({ canGoBack: true })
        onBack({ canGoBack: false })

        expect(plugin.exitApp).toHaveBeenCalledTimes(2)
        expect(historyBack).not.toHaveBeenCalled()
    })

    it('an interceptor takes Back over, and only until it is removed', async () => {
        const { installBackButtonHandling, pushBackInterceptor } = await load()
        installBackButtonHandling()
        const onBack = plugin.addListener.mock.calls[0][1]
        const handler = vi.fn()

        const remove = pushBackInterceptor(handler)
        onBack({ canGoBack: true })
        expect(handler).toHaveBeenCalledOnce()
        expect(historyBack).not.toHaveBeenCalled()

        remove()
        onBack({ canGoBack: true })
        expect(handler).toHaveBeenCalledOnce()
        expect(plugin.exitApp).toHaveBeenCalledOnce()
        expect(historyBack).not.toHaveBeenCalled()
    })

    it('can register again if the first registration failed', async () => {
        const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
        plugin.addListener.mockRejectedValueOnce(new Error('no plugin'))
        const { installBackButtonHandling } = await load()

        installBackButtonHandling()
        await flushPromises()
        installBackButtonHandling()

        expect(plugin.addListener).toHaveBeenCalledTimes(2)
        errorLog.mockRestore()
    })
})
