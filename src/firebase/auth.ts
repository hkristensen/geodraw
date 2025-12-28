// Anonymous authentication with nickname support
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './config'

export interface PlayerProfile {
    id: string
    nickname: string
    createdAt: number
    gamesPlayed: number
}

// Sign in anonymously and return user
export async function signInAnonymous(): Promise<User> {
    const result = await signInAnonymously(auth)
    console.log('🔐 Signed in anonymously:', result.user.uid)
    return result.user
}

// Set player nickname in Firestore
export async function setPlayerNickname(userId: string, nickname: string): Promise<void> {
    const playerRef = doc(db, 'players', userId)
    const existing = await getDoc(playerRef)

    if (existing.exists()) {
        // Update existing player
        await setDoc(playerRef, {
            ...existing.data(),
            nickname
        }, { merge: true })
    } else {
        // Create new player profile
        const profile: PlayerProfile = {
            id: userId,
            nickname,
            createdAt: Date.now(),
            gamesPlayed: 0
        }
        await setDoc(playerRef, profile)
    }
    console.log('👤 Set nickname:', nickname)
}

// Get player profile from Firestore
export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
    const playerRef = doc(db, 'players', userId)
    const snapshot = await getDoc(playerRef)

    if (snapshot.exists()) {
        return snapshot.data() as PlayerProfile
    }
    return null
}

// Get current auth user (or null)
export function getCurrentUser(): User | null {
    return auth.currentUser
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback)
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
    return auth.currentUser !== null
}
