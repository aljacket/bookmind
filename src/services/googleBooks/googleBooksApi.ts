// src/services/googleBooks/googleBooksApi.ts

import axios from 'axios'

const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
const BASE_URL = 'https://www.googleapis.com/books/v1/volumes'

export interface GoogleBookDetails {
    isbn10: string
    isbn13: string
    pageCount?: number
    publishedDate?: string
    thumbnailUrl?: string
    googleBooksId: string
}

export async function getBookDetails(
    title: string,
    author: string
): Promise<GoogleBookDetails | null> {
    try {
        if (!API_KEY) {
            console.error('Google Books API key is not configured')
            return null
        }

        const response = await axios.get(`${BASE_URL}`, {
            params: {
                q: `intitle:${title}+inauthor:${author}`,
                key: API_KEY
            }
        })

        if (response.data.items && response.data.items.length > 0) {
            const item = response.data.items[0]
            const book = item.volumeInfo
            return {
                isbn10:
                    book.industryIdentifiers?.find((id: any) => id.type === 'ISBN_10')
                        ?.identifier || '',
                isbn13:
                    book.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')
                        ?.identifier || '',
                pageCount: book.pageCount,
                publishedDate: book.publishedDate,
                thumbnailUrl: book.imageLinks?.thumbnail,
                googleBooksId: item.id || ''
            }
        }

        return null
    } catch (error: any) {
        if (error.response?.status === 403) {
            console.error('Google Books API access denied. Please check API key and permissions')
        } else {
            console.error('Error fetching book details:', error.response?.data || error.message)
        }
        return null
    }
}
