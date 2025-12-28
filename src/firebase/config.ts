// Firebase configuration and initialization
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
    apiKey: "AIzaSyAfvgSFmx_Ieszosr8gbYS_Ch9quRXFiQc",
    authDomain: "geodraw-game-7392.firebaseapp.com",
    projectId: "geodraw-game-7392",
    storageBucket: "geodraw-game-7392.firebasestorage.app",
    messagingSenderId: "1061511872518",
    appId: "1:1061511872518:web:7b4c74579be7d98d168387"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'europe-west1')

