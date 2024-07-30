import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import app from './config'

export const initAuth = () => getAuth(app)
export const initFirestore = () => getFirestore(app)
