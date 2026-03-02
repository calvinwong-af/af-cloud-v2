import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

export async function signIn(email: string, password: string, keepSignedIn: boolean = false) {
  const auth = getFirebaseAuth();
  // Always use local persistence so auth state survives tab close/reopen.
  // keepSignedIn controls only the cookie lifetime:
  //   false → session cookie (expires when browser fully closes)
  //   true  → persistent cookie (30 days, survives browser restarts)
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  const token = await result.user.getIdToken();

  if (keepSignedIn) {
    document.cookie = `af-session=${token}; path=/; max-age=2592000; samesite=strict`;
    document.cookie = `af-persist=1; path=/; max-age=2592000; samesite=strict`;
  } else {
    document.cookie = `af-session=${token}; path=/; samesite=strict`;
    document.cookie = `af-persist=0; path=/; samesite=strict`;
  }
  return result;
}

export async function signOut() {
  document.cookie = "af-session=; path=/; max-age=0";
  document.cookie = "af-persist=; path=/; max-age=0";
  return firebaseSignOut(getFirebaseAuth());
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

// Call this once in the root layout to keep the cookie fresh as Firebase
// silently refreshes the ID token every hour.
// Reads af-persist marker to preserve the original keepSignedIn choice.
export function startTokenRefresh() {
  return onIdTokenChanged(getFirebaseAuth(), async (user) => {
    if (user) {
      const token = await user.getIdToken();
      const isPersistent = document.cookie
        .split(";")
        .some((c) => c.trim() === "af-persist=1");
      if (isPersistent) {
        document.cookie = `af-session=${token}; path=/; max-age=2592000; samesite=strict`;
      } else {
        document.cookie = `af-session=${token}; path=/; samesite=strict`;
      }
    } else {
      document.cookie = "af-session=; path=/; max-age=0";
    }
  });
}
