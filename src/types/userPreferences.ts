export interface UserPreferences {
    genre: string
    bookLength: string
    period: string
    complexity: string
    purpose: string
    learningGoal?: string
    lang: 'en' | 'es' | 'it'
}

export interface BookRecommendation {
    title: string
    author: string
    fullRecommendation?: string
    isbn10?: string
    isbn13?: string
    pageCount?: number
    publishedDate?: string
    thumbnailUrl?: string
    amazonLink?: string
    googleBooksLink?: string
    googleBooksId?: string
}

export function isValidUserPreferences(obj: any): obj is UserPreferences {
    return (
        typeof obj === 'object' &&
        typeof obj.genre === 'string' &&
        typeof obj.bookLength === 'string' &&
        typeof obj.period === 'string' &&
        typeof obj.complexity === 'string' &&
        typeof obj.purpose === 'string' &&
        (obj.learningGoal === undefined || typeof obj.learningGoal === 'string')
    )
}

export type SupportedLocale = 'en' | 'it' | 'es'
