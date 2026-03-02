import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

export async function signIn(email: string, password: string, keepSignedIn: boolean = false) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  const token = await result.user.getIdToken();
  const maxAge = keepSignedIn ? 2592000 : 3600;
  document.cookie = `af-session=${token}; path=/; max-age=${maxAge}; samesite=strict`;
  return result;
}

export async function signOut() {
  document.cookie = "af-session=; path=/; max-age=0";
  return firebaseSignOut(getFirebaseAuth());
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

// Call this once in the root layout to keep the cookie fresh as Firebase
// silently refreshes the ID token every hour
export function startTokenRefresh() {
  return onIdTokenChanged(getFirebaseAuth(), async (user) => {
    if (user) {
      const token = await user.getIdToken();
      document.cookie = `af-session=${token}; path=/; max-age=2592000; samesite=strict`;
    } else {
      document.cookie = "af-session=; path=/; max-age=0";
    }
  });
}
