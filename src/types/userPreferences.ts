export interface BookRecommendation {
    title: string
    author: string
    reason?: string
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

export type SupportedLocale = 'en' | 'it' | 'es'

export interface TranscriptTurn {
    role: 'user' | 'assistant'
    content: string
}

export type Transcript = TranscriptTurn[]