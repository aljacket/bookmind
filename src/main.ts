import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initAuth } from '@/services/firebase/config'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { runStartupSweep } from '@/services/account/startupSweep'
import { onAuthStateChanged } from 'firebase/auth'
import App from './App.vue'
import router from './router'
import i18n from './plugins/i18n'
import './index.css'
import './services/firebase/config'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)

// Initialize stores
const auth = initAuth()
const authStore = useAuthStore()
const languageStore = useLanguageStore()

// Initialize language before mounting
languageStore.initializeLanguage()

let appMounted = false

onAuthStateChanged(auth, async (user) => {
    authStore.setUser(user)

    if (!appMounted) {
        appMounted = true

        // Heal an account deletion that was interrupted after Firebase deleted the user (card #63).
        // This is the first emission, so Firebase Auth has finished initialising. A failing sweep
        // must never keep the app from opening: its marker stays and the next launch retries.
        let sweepOutcome: Awaited<ReturnType<typeof runStartupSweep>> = 'none'
        try {
            sweepOutcome = await runStartupSweep(user?.uid ?? null)
        } catch (error) {
            console.error('Startup sweep failed', error)
        }

        app.use(router)
        if (sweepOutcome === 'wiped') {
            await router.replace({ path: '/login', query: { deleted: '1' } })
        }
        app.mount('#app')
    }
})
