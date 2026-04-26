import api from '@/services/api/axios'
import { useLanguageStore } from '@/stores/language'
import type { BookRecommendation, Transcript } from '@/types/userPreferences'

export async function fetchClarifier(transcript: Transcript): Promise<{ question: string }> {
    const lang = useLanguageStore().selectedLanguage
    const { data } = await api.post('/recommendations/clarify', { lang, transcript })
    return data
}

export async function fetchRecommendations(transcript: Transcript): Promise<BookRecommendation[]> {
    const lang = useLanguageStore().selectedLanguage
    const { data } = await api.post('/recommendations', { lang, transcript })
    return data
}
