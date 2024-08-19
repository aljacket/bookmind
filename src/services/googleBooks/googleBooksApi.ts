// src/services/googleBooks/googleBooksApi.ts

import axios from 'axios'

const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'

interface GoogleBooksResponse {
    items: Array<{
        volumeInfo: {
            industryIdentifiers?: Array<{
                type: string
                identifier: string
            }>
            pageCount?: number
            publishedDate?: string
            imageLinks?: {
                thumbnail?: string
            }
        }
    }>
}

export async function getBookDetails(title: string, author: string) {
    try {
        const response = await axios.get<GoogleBooksResponse>(`${BASE_URL}`, {
            params: {
                q: `intitle:${title}+inauthor:${author}`,
                key: API_KEY
            }
        })

        if (response.data.items && response.data.items.length > 0) {
            const book = response.data.items[0].volumeInfo
            const isbn10 = book.industryIdentifiers?.find((id) => id.type === 'ISBN_10')?.identifier
            const isbn13 = book.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier

            return {
                isbn10: isbn10 || '',
                isbn13: isbn13 || '',
                pageCount: book.pageCount,
                publishedDate: book.publishedDate,
                thumbnailUrl: book.imageLinks?.thumbnail
            }
        }

        return null
    } catch (error) {
        console.error('Errore nella ricerca del libro:', error)
        return null
    }
}
