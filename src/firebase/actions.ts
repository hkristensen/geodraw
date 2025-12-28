
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    orderBy,
    limit
} from 'firebase/firestore'
import { db } from './config'
import type { ClientAction, ClientActionType } from '../types/game'

/**
 * Sends an action request to the Host (Host processes it via subscription)
 */
export async function sendAction(
    gameId: string,
    type: ClientActionType,
    playerId: string,
    payload: any
): Promise<string> {
    const actionsRef = collection(db, 'games', gameId, 'actions')

    const action: Omit<ClientAction, 'id'> = {
        type,
        playerId,
        payload,
        createdAt: Date.now(),
        status: 'pending'
    }

    try {
        const docRef = await addDoc(actionsRef, {
            ...action,
            serverTimestamp: serverTimestamp() // Audit trail
        })
        console.log(`📤 Action sent: ${type} (${docRef.id})`)
        return docRef.id
    } catch (e) {
        console.error('❌ Failed to send action:', e)
        throw e
    }
}

/**
 * Host ONLY: Subscribe to pending actions to process them
 */
export function subscribeToActions(
    gameId: string,
    callback: (actions: ClientAction[]) => void
): () => void {
    const actionsRef = collection(db, 'games', gameId, 'actions')

    // Listen for PENDING actions
    const q = query(
        actionsRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc'),
        limit(50) // Process batch
    )

    console.log(`📥 Subscribing to actions for game: ${gameId}`)

    return onSnapshot(q, (snapshot) => {
        const actions: ClientAction[] = []
        snapshot.forEach((doc) => {
            actions.push({ ...doc.data(), id: doc.id } as ClientAction)
        })

        if (actions.length > 0) {
            callback(actions)
        }
    }, (error) => {
        console.error('❌ Action subscription error:', error)
    })
}

/**
 * Host ONLY: Mark an action as processed so it doesn't run again
 */
export async function markActionProcessed(
    gameId: string,
    actionId: string,
    status: 'processed' | 'failed' = 'processed'
): Promise<void> {
    const actionRef = doc(db, 'games', gameId, 'actions', actionId)

    await updateDoc(actionRef, {
        status,
        processedAt: Date.now()
    })
}
