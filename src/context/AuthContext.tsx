import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from '../firebase';

interface UserProfile {
  uid: string;
  email: string;
  username: string;
  profileImage: string;
  subscriptionPlan: 'free' | 'premium' | 'pro';
  healthScore: number;
  role: 'user' | 'admin';
  createdAt: string;
  walletAddress?: string;
  subscriptionExpiresAt?: string;
  points: number;
  streak: number;
  lastCheckIn?: string;
  dailyLikesCount: number;
  dailyCommentsCount: number;
  lastActionDate?: string;
  checkInHistory?: string[];
  referralCode?: string;
  referredBy?: string;
  referralsCount?: number;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isCreator?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: loginWithGoogle,
  logout: logout,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            
            // Auto-upgrade alexmetav@gmail.com to admin if they aren't already
            if (currentUser.email === "alexmetav@gmail.com" && data.role !== 'admin') {
              data.role = 'admin';
              await setDoc(userRef, { role: 'admin' }, { merge: true });
            }
            
            setProfile(data);
          } else {
            // Create new user profile
            const isAdminEmail = currentUser.email === "alexmetav@gmail.com";
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              username: currentUser.displayName || 'New User',
              profileImage: currentUser.photoURL || '',
              subscriptionPlan: 'free',
              healthScore: 100,
              role: isAdminEmail ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              points: 0,
              streak: 0,
              dailyLikesCount: 0,
              dailyCommentsCount: 0,
              referralCode: currentUser.uid.slice(0, 8).toUpperCase(),
              referralsCount: 0,
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              isCreator: false,
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login: loginWithGoogle, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
