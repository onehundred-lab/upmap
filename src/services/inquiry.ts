import { db } from './firebase';
import { ref, push, set, onValue, off, remove } from 'firebase/database';

export interface Inquiry {
  id: string;
  text: string;
  createdAt: string;
}

export async function submitInquiry(text: string): Promise<void> {
  const listRef = ref(db, 'upmap/inquiries');
  const newRef = push(listRef);
  await set(newRef, { text, createdAt: new Date().toISOString() });
}

export function listenInquiries(callback: (list: Inquiry[]) => void): () => void {
  const listRef = ref(db, 'upmap/inquiries');
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const val = snap.val();
    const list: Inquiry[] = Object.entries(val)
      .map(([id, v]: [string, any]) => ({ id, ...v }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(list);
  };
  onValue(listRef, handler);
  return () => off(listRef, 'value', handler);
}

export async function deleteInquiry(id: string): Promise<void> {
  await remove(ref(db, `upmap/inquiries/${id}`));
}
