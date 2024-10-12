import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import it from '@/locales/it.json'
import es from '@/locales/es.json'

const i18n = createI18n({
    locale: navigator.language.split('-')[0] || 'en', // Imposta la lingua del dispositivo o inglese
    fallbackLocale: 'en',
    messages: {
        en,
        it,
        es
    }
})

export default i18n
