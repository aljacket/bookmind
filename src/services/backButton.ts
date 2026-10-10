import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android hardware/gesture Back handling.
 *
 * Once `@capacitor/app` is installed, Capacitor stops running its own default for Back whenever it
 * has a `backButton` listener, and with no listener it only goes back in history and never leaves
 * the app. So the app registers ONE listener at startup that reproduces the previous behaviour
 * (history back, or leave the app at the root), and lets a component temporarily take Back over
 * through `pushBackInterceptor` for exactly as long as it is on screen.
 */

type Interceptor = () => void

const interceptors: Interceptor[] = []
let installed = false

/** Makes `handler` receive Back instead of the default, until the returned function is called. */
export function pushBackInterceptor(handler: Interceptor): () => void {
    interceptors.push(handler)
    return () => {
        const index = interceptors.lastIndexOf(handler)
        if (index !== -1) interceptors.splice(index, 1)
    }
}

/** What Back does for the app: the innermost interceptor if any, otherwise the previous default. */
export function handleBackButton(canGoBack: boolean) {
    const top = interceptors[interceptors.length - 1]
    if (top) {
        top()
        return
    }
    if (canGoBack) {
        window.history.back()
    } else {
        void App.exitApp()
    }
}

/** Registers the single Back listener. Call once at startup; it does nothing on the web and iOS. */
export function installBackButtonHandling() {
    if (installed || !Capacitor.isNativePlatform()) return
    installed = true
    App.addListener('backButton', ({ canGoBack }) => handleBackButton(canGoBack)).catch((error) => {
        installed = false
        console.error('Could not listen for the Back button', error)
    })
}
