import axios from 'axios'
import type { UserPreferences } from '@/types/userPreferences'
import { useLanguageStore } from '@/stores/language'

export async function getBookRecommendations(preferences: UserPreferences) {
    const languageStore = useLanguageStore()
    const lang = languageStore.selectedLanguage

    const payload = {
        ...preferences,
        lang
    }

    try {
        // Make a POST request to your FastAPI server with the language
        const response = await axios.post('http://127.0.0.1:8000/recommendations', payload)
        return response.data
    } catch (error: any) {
        console.error('Error fetching recommendations:', error.response?.data || error.message)
        throw error
    }
}
