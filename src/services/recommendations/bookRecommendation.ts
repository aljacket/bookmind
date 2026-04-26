import api from '@/services/api/axios'
import { useLanguageStore } from '@/stores/language'
import { getReadingList } from '@/services/indexedDB/userPreferences'
import type { BookRecommendation, Transcript } from '@/types/userPreferences'

const LIKED_BOOKS_PROMPT_CAP = 20

interface LikedBookPayload {
    title: string
    author: string
}

export async function getLikedBooksForRecommendation(
    userId: string
): Promise<LikedBookPayload[]> {
    const list = await getReadingList(userId)
    return list
        .filter((b) => b.status === 'read' && b.liked === true)
        .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
        .slice(0, LIKED_BOOKS_PROMPT_CAP)
        .map(({ title, author }) => ({ title, author }))
}

export async function fetchClarifier(transcript: Transcript): Promise<{ question: string }> {
    const lang = useLanguageStore().selectedLanguage
    const { data } = await api.post('/recommendations/clarify', { lang, transcript })
    return data
}

export async function fetchRecommendations(
    transcript: Transcript,
    userId?: string
): Promise<BookRecommendation[]> {
    const lang = useLanguageStore().selectedLanguage
    const payload: { lang: string; transcript: Transcript; liked_books?: LikedBookPayload[] } = {
        lang,
        transcript
    }
    if (userId) {
        const liked = await getLikedBooksForRecommendation(userId)
        if (liked.length > 0) {
            payload.liked_books = liked
        }
    }
    const { data } = await api.post('/recommendations', payload)
    return data
}
