import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';

export type ActivityType = 'post' | 'comment';

interface SpamCheckResult {
  isSpam: boolean;
  timeoutUntil: string | null;
}

export async function checkSpam(userId: string, type: ActivityType, currentTimeoutUntil?: string): Promise<SpamCheckResult> {
  if (currentTimeoutUntil) {
    const timeoutDate = new Date(currentTimeoutUntil);
    if (timeoutDate > new Date()) {
      return { isSpam: true, timeoutUntil: currentTimeoutUntil };
    }
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const activityQuery = query(
    collection(db, 'activity_logs'),
    where('userId', '==', userId),
    where('type', '==', type),
    where('timestamp', '>=', Timestamp.fromDate(fiveMinutesAgo))
  );

  const snapshot = await getDocs(activityQuery);
  const count = snapshot.size;
  const threshold = type === 'comment' ? 15 : 100;

  if (count >= threshold) {
    const timeoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      spamTimeoutUntil: timeoutUntil
    });
    return { isSpam: true, timeoutUntil };
  }

  return { isSpam: false, timeoutUntil: null };
}

export async function logActivity(userId: string, type: ActivityType) {
  await addDoc(collection(db, 'activity_logs'), {
    userId,
    type,
    timestamp: Timestamp.now()
  });
}
