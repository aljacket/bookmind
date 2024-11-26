import axios from 'axios'
import type { UserPreferences } from '@/types/userPreferences'

export async function getBookRecommendations(preferences: UserPreferences) {
    try {
        // Make a POST request to your FastAPI server
        const response = await axios.post('http://127.0.0.1:8000/recommendations', preferences)
        return response.data
    } catch (error: any) {
        console.error('Error fetching recommendations:', error.response?.data || error.message)
        throw error
    }
}
