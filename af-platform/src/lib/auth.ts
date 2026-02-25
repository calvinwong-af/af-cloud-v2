import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  const token = await result.user.getIdToken();
  document.cookie = `af-session=${token}; path=/; max-age=3600; samesite=strict`;
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
      document.cookie = `af-session=${token}; path=/; max-age=3600; samesite=strict`;
    } else {
      document.cookie = "af-session=; path=/; max-age=0";
    }
  });
}
