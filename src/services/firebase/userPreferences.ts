import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from './config'
import { useAuthStore } from '@/stores/auth'
import type { UserPreferences } from '@/types/userPreferences'

export async function saveUserPreferences(preferences: UserPreferences) {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('User not authenticated')

    const userRef = doc(db, 'users', authStore.user.uid)
    await setDoc(userRef, { preferences }, { merge: true })
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
    const authStore = useAuthStore()
    if (!authStore.user) return null

    const userRef = doc(db, 'users', authStore.user.uid)
    const docSnap = await getDoc(userRef)

    if (docSnap.exists()) {
        return docSnap.data().preferences
    }
    return null
}
