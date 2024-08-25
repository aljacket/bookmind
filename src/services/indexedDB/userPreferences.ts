// src/services/indexedDB/userPreferences.ts

import type { UserPreferences } from '@/types/userPreferences'
import { isValidUserPreferences } from '@/types/userPreferences'
import type { BookRecommendation } from '@/types/userPreferences'

const DB_NAME = 'BookMindDB'
const STORE_NAME = 'userPreferences'
const DB_VERSION = 2

const USER_PREFERENCES_STORE = 'userPreferences'
const LAST_RECOMMENDATIONS_KEY = 'lastRecommendations'
const API_CALLS_STORE = 'apiCalls'

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
        }
    })
}

export async function saveUserPreferences(
    userId: string,
    preferences: UserPreferences
): Promise<void> {
    if (!isValidUserPreferences(preferences)) {
        throw new Error('Invalid preferences object')
    }

    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.put(JSON.parse(JSON.stringify(preferences)), userId)

        request.onerror = () => reject('Error saving preferences')
        request.onsuccess = () => resolve()
    })
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(userId)

        request.onerror = () => reject('Error getting preferences')
        request.onsuccess = () => {
            const result = request.result
            if (result && isValidUserPreferences(result)) {
                resolve(result)
            } else {
                resolve(null)
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

        request.onerror = () => reject('Errore nel salvataggio delle ultime raccomandazioni')
        request.onsuccess = () => resolve()
    })
}

export async function getLastRecommendations(userId: string): Promise<BookRecommendation[] | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(`${userId}_${LAST_RECOMMENDATIONS_KEY}`)

        request.onerror = () => reject('Errore nel recupero delle ultime raccomandazioni')
        request.onsuccess = () => {
            const result = request.result
            resolve(result ? result : null)
        }
    })
}

export async function incrementApiCallCount(userId: string): Promise<boolean> {
    const db = await openDB()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const key = `${userId}_${today}`

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(API_CALLS_STORE, 'readwrite')
        const store = transaction.objectStore(API_CALLS_STORE)
        const getRequest = store.get(key)

        getRequest.onsuccess = () => {
            let currentCallsData = getRequest.result

            if (!currentCallsData) {
                // Primo accesso del giorno, inizializza il contatore
                currentCallsData = { count: 0, lastReset: now.getTime() }
            } else {
                // Controlla se sono passate 24 ore dall'ultimo reset
                const hoursSinceLastReset =
                    (now.getTime() - currentCallsData.lastReset) / (1000 * 60 * 60)
                if (hoursSinceLastReset >= 24) {
                    // Resetta il contatore se sono passate 24 ore
                    currentCallsData = { count: 0, lastReset: now.getTime() }
                }
            }

            if (currentCallsData.count >= 2) {
                resolve(false) // Limite giornaliero raggiunto
            } else {
                currentCallsData.count++
                const putRequest = store.put(currentCallsData, key)
                putRequest.onsuccess = () => resolve(true)
                putRequest.onerror = () => reject("Errore nell'incremento delle chiamate API")
            }
        }
        getRequest.onerror = () => reject('Errore nel recupero delle chiamate API')
    })
}

export async function getRemainingCalls(userId: string): Promise<number> {
    const db = await openDB()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const key = `${userId}_${today}`

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(API_CALLS_STORE, 'readonly')
        const store = transaction.objectStore(API_CALLS_STORE)
        const getRequest = store.get(key)

        getRequest.onsuccess = () => {
            const currentCallsData = getRequest.result
            if (!currentCallsData) {
                resolve(2) // Nessuna chiamata fatta oggi
            } else {
                const hoursSinceLastReset =
                    (now.getTime() - currentCallsData.lastReset) / (1000 * 60 * 60)
                if (hoursSinceLastReset >= 24) {
                    resolve(2) // Sono passate 24 ore, reset
                } else {
                    resolve(2 - currentCallsData.count)
                }
            }
        }
        getRequest.onerror = () => reject('Errore nel recupero delle chiamate API')
    })
}
