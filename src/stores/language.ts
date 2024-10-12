import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLanguageStore = defineStore('language', {
    state: () => ({
        selectedLanguage: ref(
            localStorage.getItem('language') || navigator.language.split('-')[0] || 'en'
        )
    }),
    actions: {
        setLanguage(newLanguage: string) {
            this.selectedLanguage = newLanguage
            localStorage.setItem('language', newLanguage)
        }
    }
})
