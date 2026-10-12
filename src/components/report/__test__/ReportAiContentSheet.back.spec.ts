import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it_ from '@/locales/it.json'
import es from '@/locales/es.json'

const { service, plugin } = vi.hoisted(() => ({
    service: { submitReport: vi.fn() },
    plugin: { addListener: vi.fn(), exitApp: vi.fn() }
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/app', () => ({
    App: { addListener: plugin.addListener, exitApp: plugin.exitApp }
}))
vi.mock('@/services/reports/reportAiContent', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/reports/reportAiContent')>()),
    submitReport: service.submitReport
}))

import { installBackButtonHandling } from '@/services/backButton'
import { ReportError, clarifierTarget } from '@/services/reports/reportAiContent'
import ReportAiContentSheet from '../ReportAiContentSheet.vue'

let wrapper: VueWrapper
let onBack: (event: { canGoBack: boolean }) => void

const mountSheet = () => {
    const i18n = createI18n({
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
        messages: { en, it: it_, es }
    })
    wrapper = mount(ReportAiContentSheet, {
        attachTo: document.body,
        props: { target: clarifierTarget('Which mood do you want?') },
        global: { plugins: [i18n] }
    })
}

describe('ReportAiContentSheet: Android Back button', () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    beforeEach(() => {
        historyBack.mockClear()
        plugin.exitApp.mockReset().mockResolvedValue(undefined)
        if (!onBack) {
            plugin.addListener.mockResolvedValue({ remove: vi.fn() })
            installBackButtonHandling()
            onBack = plugin.addListener.mock.calls[0][1]
        }
        service.submitReport.mockReset()
    })

    afterEach(() => {
        wrapper?.unmount()
    })

    it('closes the idle sheet, like Escape, without sending or navigating', () => {
        mountSheet()

        onBack({ canGoBack: true })

        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(service.submitReport).not.toHaveBeenCalled()
        expect(historyBack).not.toHaveBeenCalled()
        expect(plugin.exitApp).not.toHaveBeenCalled()
    })

    it('is ignored while the report is being sent, and works again after a failure', async () => {
        let reject!: (reason: unknown) => void
        service.submitReport.mockReturnValue(new Promise((_, rej) => (reject = rej)))
        mountSheet()
        await wrapper.find('input[value="other"]').setValue(true)
        await wrapper.find('form').trigger('submit')

        onBack({ canGoBack: false })
        expect(wrapper.emitted('close')).toBeUndefined()
        expect(historyBack).not.toHaveBeenCalled()
        expect(plugin.exitApp).not.toHaveBeenCalled()

        reject(new ReportError('generic'))
        await flushPromises()

        onBack({ canGoBack: false })
        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('once the sheet is gone, Back behaves as before again: it leaves the app', () => {
        mountSheet()
        wrapper.unmount()

        onBack({ canGoBack: true })

        expect(plugin.exitApp).toHaveBeenCalledOnce()
        expect(historyBack).not.toHaveBeenCalled()
    })
})
