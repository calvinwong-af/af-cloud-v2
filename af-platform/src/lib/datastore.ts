import { getFirestore, collection, getDocs, doc, getDoc, type Firestore } from "firebase/firestore";
import { getApp } from "./firebase";

let _db: Firestore | undefined;

export function db() {
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}

export async function getCollection<T>(name: string): Promise<T[]> {
  try {
    const snapshot = await getDocs(collection(db(), name));
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as T));
  } catch (error) {
    console.error(`Failed to fetch collection "${name}":`, error);
    throw error;
  }
}

export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    const snap = await getDoc(doc(db(), collectionName, id));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() } as T;
  } catch (error) {
    console.error(`Failed to fetch document "${collectionName}/${id}":`, error);
    throw error;
  }
}
