import type { SupportedLocale } from '@/types/userPreferences'
import { convertISBN13ToISBN10 } from '@/utils/isbnUtils'
import { amazonTldFor, type StoreCountry } from '@/utils/storeRegion'

interface AmazonBookId {
    isbn10?: string
    isbn13?: string
}

interface GoogleBookId {
    googleBooksId?: string
}

export function buildAmazonLink(book: AmazonBookId, country: StoreCountry): string {
    const tld = amazonTldFor(country)
    const base = `https://www.amazon.${tld}`

    if (book.isbn10) {
        return `${base}/dp/${book.isbn10}`
    }

    if (book.isbn13) {
        if (book.isbn13.startsWith('978')) {
            const derived = convertISBN13ToISBN10(book.isbn13)
            if (derived !== book.isbn13) {
                return `${base}/dp/${derived}`
            }
        }
        return `${base}/s?k=${book.isbn13}`
    }

    return ''
}

export function buildGoogleBooksLink(book: GoogleBookId, lang: SupportedLocale): string {
    if (!book.googleBooksId) return ''
    return `https://books.google.com/books?id=${book.googleBooksId}&hl=${lang}`
}
