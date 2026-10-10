import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android hardware/gesture Back handling.
 *
 * Without `@capacitor/app`, Back leaves the app from every screen. Installing the plugin changes
 * that default (with no listener it only goes back in history and never leaves), so the app
 * registers ONE listener at startup that restores exactly the old behaviour (leave the app), and
 * lets a component temporarily take Back over through `pushBackInterceptor` for as long as it is on
 * screen. History-based Back is a product change and deliberately not done here.
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

/** What Back does for the app: the innermost interceptor if any, otherwise leave the app. */
export function handleBackButton() {
    const top = interceptors[interceptors.length - 1]
    if (top) {
        top()
        return
    }
    void App.exitApp()
}

/** Registers the single Back listener. Call once at startup; it does nothing on the web and iOS. */
export function installBackButtonHandling() {
    if (installed || !Capacitor.isNativePlatform()) return
    installed = true
    App.addListener('backButton', () => handleBackButton()).catch((error) => {
        installed = false
        console.error('Could not listen for the Back button', error)
    })
}
