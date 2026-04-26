export type ReadStatus = 'to-read' | 'read'

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
    googleBooksId?: string
    // Note: legacy records may still carry `amazonLink` / `googleBooksLink` JSON keys
    // from prior versions. They are no longer typed — link URLs are derived at render
    // time from the persisted identifiers (isbn10/isbn13/googleBooksId) + current locale.
    status?: ReadStatus
    liked?: boolean
    savedAt?: number
}

export type SupportedLocale = 'en' | 'it' | 'es'

export interface TranscriptTurn {
    role: 'user' | 'assistant'
    content: string
}

export type Transcript = TranscriptTurn[]
