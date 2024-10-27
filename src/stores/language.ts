import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Ref } from 'vue'
import i18n from '@/plugins/i18n'

type SupportedLocale = 'en' | 'it' | 'es'

export const useLanguageStore = defineStore('language', () => {
    const selectedLanguage: Ref<SupportedLocale> = ref(
        (localStorage.getItem('language') as SupportedLocale) ||
            (navigator.language.split('-')[0] as SupportedLocale) ||
            'en'
    )

    function setLanguage(newLanguage: SupportedLocale) {
        selectedLanguage.value = newLanguage
        localStorage.setItem('language', newLanguage)
        // Aggiorna la lingua in i18n
        i18n.global.locale.value = newLanguage
    }

    function initializeLanguage() {
        const savedLanguage = localStorage.getItem('language') as SupportedLocale
        if (savedLanguage) {
            selectedLanguage.value = savedLanguage
            i18n.global.locale.value = savedLanguage
        }
    }

    return {
        selectedLanguage,
        setLanguage,
        initializeLanguage
    }
})
