import type { UserPreferences } from '@/types/userPreferences'
import { isValidUserPreferences } from '@/types/userPreferences'

const DB_NAME = 'BookMindDB'
const STORE_NAME = 'userPreferences'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => reject('Error opening database')
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            db.createObjectStore(STORE_NAME)
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
