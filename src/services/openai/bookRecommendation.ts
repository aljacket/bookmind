import axios from 'axios'
import type { UserPreferences } from '@/types/userPreferences'
import { useLanguageStore } from '@/stores/language'

// Create an axios instance with the base URL
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
})

export async function getBookRecommendations(preferences: UserPreferences) {
    const languageStore = useLanguageStore()
    const lang = languageStore.selectedLanguage

    const payload = {
        ...preferences,
        lang
    }

    try {
        console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL) // Debug log
        const response = await api.post('/recommendations', payload)
        return response.data
    } catch (error: any) {
        console.error('Error fetching recommendations:', error.response?.data || error.message)
        if (error.response) {
            console.error('Response status:', error.response.status)
            console.error('Response data:', error.response.data)
        }
        throw error
    }
}
