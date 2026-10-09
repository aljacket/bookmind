import axios from 'axios'
import { auth } from '@/services/firebase/config'

// Recommendation calls wait for a possible Cloud Run cold start plus the LLM round trip.
export const RECOMMENDATION_TIMEOUT_MS = 30_000

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    }
})

// Every call to the backend carries the Firebase ID token of the signed-in user.
// getIdToken() returns the cached token and refreshes it shortly before it expires.
// Without a signed-in user no header is sent and the backend answers 401.
api.interceptors.request.use(async (config) => {
    const user = auth.currentUser
    if (user) {
        const token = await user.getIdToken()
        config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
})

// Response error interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)

export type ApiErrorKind = 'quota' | 'session' | 'generic'

// 429: daily quota exhausted. 401: token missing, invalid, expired or revoked.
// Anything else (500, 503, timeout, network) is a generic failure.
export function classifyApiError(error: unknown): ApiErrorKind {
    if (!axios.isAxiosError(error)) return 'generic'
    if (error.response?.status === 429) return 'quota'
    if (error.response?.status === 401) return 'session'
    return 'generic'
}

export default api
