import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { initAuth } from '@/services/firebase/config'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
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

onAuthStateChanged(auth, (user) => {
    authStore.setUser(user)

    if (!appMounted) {
        app.use(router)
        app.mount('#app')
        appMounted = true
    }
})
