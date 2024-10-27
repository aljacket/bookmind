import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it from '@/locales/it.json'
import es from '@/locales/es.json'

const i18n = createI18n({
    legacy: false, // Use Composition API
    globalInjection: true, // Inject $t, $d, etc. globally
    locale: localStorage.getItem('language') || navigator.language.split('-')[0] || 'en',
    fallbackLocale: 'en',
    messages: {
        en,
        it,
        es
    }
})

export default i18n
