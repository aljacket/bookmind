import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { initAuth } from '@/services/firebase/config'
import { useAuthStore } from '@/stores/auth'
import { onAuthStateChanged } from 'firebase/auth'

import App from './App.vue'
import router from './router'
import './index.css'
import './services/firebase/config'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
// app.use(router)

const auth = initAuth()
const authStore = useAuthStore()

let appMounted = false

onAuthStateChanged(auth, (user) => {
    authStore.setUser(user)

    if (!appMounted) {
        app.use(router)
        app.mount('#app')
        appMounted = true
    }
})
