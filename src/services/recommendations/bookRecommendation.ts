import api from '@/services/api/axios'
import type { UserPreferences } from '@/types/userPreferences'
import { useLanguageStore } from '@/stores/language'

export async function getBookRecommendations(preferences: UserPreferences) {
    const languageStore = useLanguageStore()
    const lang = languageStore.selectedLanguage

    const payload = {
        ...preferences,
        lang
    }

    const response = await api.post('/recommendations', payload)
    return response.data
}
