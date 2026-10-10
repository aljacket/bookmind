// src/services/indexedDB/userPreferences.ts

import type { BookRecommendation, ReadStatus } from '@/types/userPreferences'

function normalizeSavedBook(book: BookRecommendation): BookRecommendation {
    return {
        ...book,
        status: book.status ?? 'to-read',
        liked: book.liked ?? false,
        savedAt: book.savedAt ?? 0
    }
}

function bookIdentityMatches(
    a: Pick<BookRecommendation, 'title' | 'author'>,
    b: Pick<BookRecommendation, 'title' | 'author'>
): boolean {
    return a.title === b.title && a.author === b.author
}

const DB_NAME = 'BookMindDB'
const STORE_NAME = 'userPreferences'
const DB_VERSION = 3

const USER_PREFERENCES_STORE = 'userPreferences'
const LAST_RECOMMENDATIONS_KEY = 'lastRecommendations'
const API_CALLS_STORE = 'apiCalls'
const READING_LIST_STORE = 'readingList'

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject('Error opening database')
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result

            if (!db.objectStoreNames.contains(USER_PREFERENCES_STORE)) {
                db.createObjectStore(USER_PREFERENCES_STORE)
            }

            if (!db.objectStoreNames.contains(API_CALLS_STORE)) {
                db.createObjectStore(API_CALLS_STORE)
            }

            if (!db.objectStoreNames.contains(READING_LIST_STORE)) {
                db.createObjectStore(READING_LIST_STORE)
            }
        }
    })
}

export async function saveLastRecommendations(
    userId: string,
    recommendations: BookRecommendation[]
): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const serializedRecommendations = JSON.parse(JSON.stringify(recommendations))
        const request = store.put(
            serializedRecommendations,
            `${userId}_${LAST_RECOMMENDATIONS_KEY}`
        )

        request.onerror = () => reject('Error saving last recommendations')
        request.onsuccess = () => resolve()
    })
}

export async function getLastRecommendations(userId: string): Promise<BookRecommendation[] | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(`${userId}_${LAST_RECOMMENDATIONS_KEY}`)

        request.onerror = () => reject('Error retrieving last recommendations')
        request.onsuccess = () => {
            const result = request.result
            resolve(result ? result : null)
        }
    })
}

export async function getReadingList(userId: string): Promise<BookRecommendation[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(READING_LIST_STORE, 'readonly')
        const store = transaction.objectStore(READING_LIST_STORE)
        const request = store.get(`${userId}_readingList`)

        request.onerror = () => reject('Error retrieving reading list')
        request.onsuccess = () => {
            const raw = (request.result as BookRecommendation[] | undefined) ?? []
            resolve(raw.map(normalizeSavedBook))
        }
    })
}

export async function saveReadingList(
    userId: string,
    books: BookRecommendation[]
): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(READING_LIST_STORE, 'readwrite')
        const store = transaction.objectStore(READING_LIST_STORE)
        const request = store.put(
            JSON.parse(JSON.stringify(books)),
            `${userId}_readingList`
        )

        request.onerror = () => reject('Error saving reading list')
        request.onsuccess = () => resolve()
    })
}

export async function addToReadingList(
    userId: string,
    book: BookRecommendation
): Promise<void> {
    const currentList = await getReadingList(userId)
    const alreadyExists = currentList.some((b) => bookIdentityMatches(b, book))
    if (!alreadyExists) {
        currentList.push({
            ...book,
            status: 'to-read',
            liked: false,
            savedAt: Date.now()
        })
        await saveReadingList(userId, currentList)
    }
}

export async function removeFromReadingList(
    userId: string,
    book: BookRecommendation
): Promise<void> {
    const currentList = await getReadingList(userId)
    const filtered = currentList.filter((b) => !bookIdentityMatches(b, book))
    await saveReadingList(userId, filtered)
}

export async function setReadingListItemStatus(
    userId: string,
    book: Pick<BookRecommendation, 'title' | 'author'>,
    status: ReadStatus
): Promise<void> {
    const currentList = await getReadingList(userId)
    const updated = currentList.map((b) => {
        if (!bookIdentityMatches(b, book)) return b
        return {
            ...b,
            status,
            liked: status === 'to-read' ? false : (b.liked ?? false)
        }
    })
    await saveReadingList(userId, updated)
}

export async function setReadingListItemLiked(
    userId: string,
    book: Pick<BookRecommendation, 'title' | 'author'>,
    liked: boolean
): Promise<void> {
    const currentList = await getReadingList(userId)
    const target = currentList.find((b) => bookIdentityMatches(b, book))
    if (!target) return
    if (target.status !== 'read') {
        console.warn(
            `setReadingListItemLiked no-op: book "${book.title}" is not in 'read' status`
        )
        return
    }
    const updated = currentList.map((b) =>
        bookIdentityMatches(b, book) ? { ...b, liked } : b
    )
    await saveReadingList(userId, updated)
}

/**
 * Removes every key that belongs to `uid` (the `${uid}_` prefix) from all three BookMindDB stores
 * (reading list, last recommendations, call counters, consent flag) in a single transaction.
 * Keys of any other uid are never touched.
 */
export async function wipeUserData(uid: string): Promise<void> {
    // An empty uid would turn the prefix into a bare "_" and could match another account's keys.
    if (!uid) throw new Error('wipeUserData requires a uid')

    const db = await openDB()
    const prefix = `${uid}_`
    const range = IDBKeyRange.bound(prefix, `${prefix}￿`)
    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(
                [USER_PREFERENCES_STORE, API_CALLS_STORE, READING_LIST_STORE],
                'readwrite'
            )
            transaction.objectStore(USER_PREFERENCES_STORE).delete(range)
            transaction.objectStore(API_CALLS_STORE).delete(range)
            transaction.objectStore(READING_LIST_STORE).delete(range)

            transaction.oncomplete = () => resolve()
            transaction.onerror = () => reject(transaction.error ?? 'Error wiping user data')
            transaction.onabort = () => reject(transaction.error ?? 'Wiping user data was aborted')
        })
    } finally {
        db.close()
    }
}
