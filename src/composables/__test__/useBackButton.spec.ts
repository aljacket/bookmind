import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

const { native, plugin } = vi.hoisted(() => ({
    native: { value: true },
    plugin: { addListener: vi.fn(), exitApp: vi.fn() }
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('@capacitor/app', () => ({
    App: { addListener: plugin.addListener, exitApp: plugin.exitApp }
}))

import { handleBackButton } from '@/services/backButton'
import { useBackButton } from '../useBackButton'

const mounted: Array<ReturnType<typeof mount>> = []
const mountHost = (handler: () => void) => {
    const wrapper = mount(
        defineComponent({
            setup() {
                useBackButton(handler)
                return () => null
            }
        })
    )
    mounted.push(wrapper)
    return wrapper
}

describe('useBackButton', () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    beforeEach(() => {
        historyBack.mockClear()
        plugin.exitApp.mockReset().mockResolvedValue(undefined)
    })

    afterEach(() => {
        // Leave no interceptor behind for the next test.
        mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    })

    it('sends Back to the handler while the component is mounted, instead of navigating', () => {
        const handler = vi.fn()
        mountHost(handler)

        handleBackButton(true)

        expect(handler).toHaveBeenCalledOnce()
        expect(historyBack).not.toHaveBeenCalled()
        expect(plugin.exitApp).not.toHaveBeenCalled()
    })

    it('gives Back back to the app once the component unmounts', () => {
        const handler = vi.fn()
        const wrapper = mountHost(handler)
        wrapper.unmount()

        handleBackButton(true)
        expect(handler).not.toHaveBeenCalled()
        expect(historyBack).toHaveBeenCalledOnce()
    })

    it('the innermost component gets Back, and the outer one gets it again when the inner unmounts', () => {
        const outer = vi.fn()
        const inner = vi.fn()
        mountHost(outer)
        const innerWrapper = mountHost(inner)

        handleBackButton(false)
        expect(inner).toHaveBeenCalledOnce()
        expect(outer).not.toHaveBeenCalled()

        innerWrapper.unmount()
        handleBackButton(false)
        expect(outer).toHaveBeenCalledOnce()
    })
})
