import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export const DAILY_LIMITS = {
  POSTS: 5,
  COMMENTS: 10,
  LIKES: 20
};

export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const checkAndUpdateDailyLimit = async (
  userId: string,
  profile: any,
  type: 'POSTS' | 'COMMENTS' | 'LIKES'
) => {
  const today = getTodayDateString();
  const lastActionDate = profile.lastActionDate;
  
  const userRef = doc(db, 'users', userId);
  let canEarnPoints = false;

  if (lastActionDate !== today) {
    // Reset all counts if it's a new day
    const updateData: any = {
      lastActionDate: today,
      dailyPostsCount: type === 'POSTS' ? 1 : 0,
      dailyCommentsCount: type === 'COMMENTS' ? 1 : 0,
      dailyLikesCount: type === 'LIKES' ? 1 : 0
    };
    await updateDoc(userRef, updateData);
    canEarnPoints = true; // Always true on a new day since limits are > 0
  } else {
    let currentCount = 0;
    if (type === 'POSTS') currentCount = profile.dailyPostsCount || 0;
    if (type === 'COMMENTS') currentCount = profile.dailyCommentsCount || 0;
    if (type === 'LIKES') currentCount = profile.dailyLikesCount || 0;

    const limit = DAILY_LIMITS[type];
    canEarnPoints = currentCount < limit;

    const updateData: any = {};
    if (type === 'POSTS') updateData.dailyPostsCount = increment(1);
    if (type === 'COMMENTS') updateData.dailyCommentsCount = increment(1);
    if (type === 'LIKES') updateData.dailyLikesCount = increment(1);

    await updateDoc(userRef, updateData);
  }

  return canEarnPoints;
};
