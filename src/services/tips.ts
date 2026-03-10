import { db } from './firebase';
import { ref, push, set, onValue, off } from 'firebase/database';

export interface Tip {
  id: string;
  text: string;
  createdAt: string;
}

export async function addTip(placeId: string, text: string): Promise<void> {
  const tipRef = push(ref(db, `upmap/tips/${placeId}`));
  await set(tipRef, { text, createdAt: new Date().toISOString() });
}

export function listenTips(placeId: string, callback: (tips: Tip[]) => void): () => void {
  const tipsRef = ref(db, `upmap/tips/${placeId}`);
  const handler = (snap: any) => {
    if (!snap.exists()) { callback([]); return; }
    const val = snap.val();
    const list: Tip[] = Object.entries(val)
      .map(([id, v]: [string, any]) => ({ id, ...v }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    callback(list);
  };
  onValue(tipsRef, handler);
  return () => off(tipsRef, 'value', handler);
}
