import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  handleFirestoreError, 
  OperationType,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as firebaseUpdateProfile
} from '../firebase';
import { ethers } from 'ethers';

interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  profileImage: string;
  subscriptionPlan: 'free' | 'premium' | 'pro';
  healthScore: number;
  role: 'user' | 'admin';
  gender?: 'male' | 'female' | 'other';
  bio?: string;
  createdAt: string;
  walletAddress?: string;
  subscriptionExpiresAt?: string;
  points: number;
  streak: number;
  lastCheckIn?: string;
  dailyLikesCount: number;
  dailyCommentsCount: number;
  dailyPostsCount: number;
  lastActionDate?: string;
  checkInHistory?: string[];
  referralCode?: string;
  referredBy?: string;
  referralsCount?: number;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  isCreator?: boolean;
  spamTimeoutUntil?: string;
  failedScanCount?: number;
  scanTimeoutUntil?: string;
  lastUsernameChange?: string;
  lastDisplayNameChange?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, username: string, name: string, gender: string, bio: string) => Promise<void>;
  loginWithWallet: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<{ success: boolean; message: string }>;
  updateDisplayName: (newName: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: loginWithGoogle,
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginWithWallet: async () => {},
  logout: logout,
  refreshProfile: async () => {},
  updateUsername: async () => ({ success: false, message: '' }),
  updateDisplayName: async () => ({ success: false, message: '' }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const registerWithEmail = async (email: string, password: string, username: string, name: string, gender: string, bio: string) => {
    try {
      const sanitizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
      
      // Check if username is taken in usernames collection
      const usernameRef = doc(db, 'usernames', sanitizedUsername);
      const usernameSnap = await getDoc(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error('Username is already taken.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Store pending data to be picked up by onAuthStateChanged
      localStorage.setItem(`pending_username_${newUser.uid}`, sanitizedUsername);
      localStorage.setItem(`pending_gender_${newUser.uid}`, gender);
      localStorage.setItem(`pending_bio_${newUser.uid}`, bio);

      // Update Firebase Auth profile
      await firebaseUpdateProfile(newUser, {
        displayName: name,
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const loginWithWallet = async () => {
    try {
      if (!(window as any).ethereum) {
        throw new Error('Please install a wallet like MetaMask.');
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];

      // Deterministic email/password for wallet users
      const email = `${address.toLowerCase()}@wallet.com`;
      const password = `wallet_${address.toLowerCase()}_auth`;

      try {
        // Try to login
        await signInWithEmailAndPassword(auth, email, password);
      } catch (loginError: any) {
        // If user doesn't exist, register them
        if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/invalid-email') {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          
          // Use last digits of address as default name/username
          const lastDigits = address.slice(-4);
          const defaultName = `User ${lastDigits}`;
          const defaultUsername = `user_${lastDigits}`;

          // Store pending data to be picked up by onAuthStateChanged
          localStorage.setItem(`pending_username_${newUser.uid}`, defaultUsername);
          localStorage.setItem(`pending_wallet_${newUser.uid}`, address);

          await firebaseUpdateProfile(newUser, {
            displayName: defaultName,
          });
        } else {
          throw loginError;
        }
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const updateUsername = async (newUsername: string): Promise<{ success: boolean; message: string }> => {
    if (!user || !profile) return { success: false, message: 'Not logged in' };

    // 14-day rule check
    if (profile.lastUsernameChange) {
      const lastChange = new Date(profile.lastUsernameChange);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastChange.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 14) {
        return { success: false, message: `You can only change your username once every 14 days. Wait ${14 - diffDays} more days.` };
      }
    }

    try {
      const sanitizedUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '_');
      const oldUsername = profile.username;

      if (sanitizedUsername === oldUsername) {
        return { success: true, message: 'Username is already set to this.' };
      }

      // Check if username is taken in usernames collection
      const newUsernameRef = doc(db, 'usernames', sanitizedUsername);
      const usernameSnap = await getDoc(newUsernameRef);
      if (usernameSnap.exists()) {
        return { success: false, message: 'Username is already taken.' };
      }

      const userRef = doc(db, 'users', user.uid);

      // Update user profile
      await updateDoc(userRef, {
        username: sanitizedUsername,
        lastUsernameChange: new Date().toISOString()
      });

      // Update usernames collection: create new, delete old
      await setDoc(newUsernameRef, { uid: user.uid });
      if (oldUsername) {
        await deleteDoc(doc(db, 'usernames', oldUsername.toLowerCase()));
      }

      await refreshProfile();
      return { success: true, message: 'Username updated successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const updateDisplayName = async (newName: string): Promise<{ success: boolean; message: string }> => {
    if (!user || !profile) return { success: false, message: 'Not logged in' };

    // 14-day rule check
    if (profile.lastDisplayNameChange) {
      const lastChange = new Date(profile.lastDisplayNameChange);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastChange.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 14) {
        return { success: false, message: `You can only change your name once every 14 days. Wait ${14 - diffDays} more days.` };
      }
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: newName,
        lastDisplayNameChange: new Date().toISOString()
      });
      await firebaseUpdateProfile(user, { displayName: newName });
      await refreshProfile();
      return { success: true, message: 'Name updated successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

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
            
            // Check for pending updates (e.g. from wallet login or email registration)
            const pendingUsername = localStorage.getItem(`pending_username_${currentUser.uid}`);
            const pendingWallet = localStorage.getItem(`pending_wallet_${currentUser.uid}`);
            const pendingGender = localStorage.getItem(`pending_gender_${currentUser.uid}`);
            const pendingBio = localStorage.getItem(`pending_bio_${currentUser.uid}`);
            
            if (pendingUsername || pendingWallet || pendingGender || pendingBio) {
              const updates: any = {};
              if (pendingUsername) updates.username = pendingUsername.toLowerCase();
              if (pendingWallet) updates.walletAddress = pendingWallet;
              if (pendingGender) updates.gender = pendingGender;
              if (pendingBio) updates.bio = pendingBio;
              
              await updateDoc(userRef, updates);

              // Update usernames collection
              if (pendingUsername) {
                await setDoc(doc(db, 'usernames', pendingUsername.toLowerCase()), { uid: currentUser.uid });
                if (data.username && data.username.toLowerCase() !== pendingUsername.toLowerCase()) {
                  await deleteDoc(doc(db, 'usernames', data.username.toLowerCase()));
                }
              }

              data.username = pendingUsername || data.username;
              if (pendingWallet) data.walletAddress = pendingWallet;
              if (pendingGender) data.gender = pendingGender as any;
              if (pendingBio) data.bio = pendingBio;
              
              localStorage.removeItem(`pending_username_${currentUser.uid}`);
              localStorage.removeItem(`pending_wallet_${currentUser.uid}`);
              localStorage.removeItem(`pending_gender_${currentUser.uid}`);
              localStorage.removeItem(`pending_bio_${currentUser.uid}`);
            }

            // Backfill username doc if missing
            if (data.username) {
              const usernameRef = doc(db, 'usernames', data.username.toLowerCase());
              const usernameSnap = await getDoc(usernameRef);
              if (!usernameSnap.exists()) {
                await setDoc(usernameRef, { uid: currentUser.uid });
              }
            }

            // Auto-upgrade alexmetav@gmail.com to admin if they aren't already
            if (currentUser.email === "alexmetav@gmail.com" && data.role !== 'admin') {
              data.role = 'admin';
              await setDoc(userRef, { role: 'admin' }, { merge: true });
            }
            
            setProfile(data);
          } else {
            // Create new user profile
            const isAdminEmail = currentUser.email === "alexmetav@gmail.com";
            const pendingUsername = localStorage.getItem(`pending_username_${currentUser.uid}`);
            const pendingWallet = localStorage.getItem(`pending_wallet_${currentUser.uid}`);
            const pendingGender = localStorage.getItem(`pending_gender_${currentUser.uid}`);
            const pendingBio = localStorage.getItem(`pending_bio_${currentUser.uid}`);

            let defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`;
            if (pendingGender === 'male') {
              defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}_male`;
            } else if (pendingGender === 'female') {
              defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}_female`;
            }

            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              username: pendingUsername || currentUser.displayName?.toLowerCase().replace(/\s+/g, '_') || 'user_' + currentUser.uid.slice(-4),
              displayName: currentUser.displayName || 'New User',
              profileImage: currentUser.photoURL || defaultAvatar,
              subscriptionPlan: 'free',
              healthScore: 100,
              role: isAdminEmail ? 'admin' : 'user',
              gender: (pendingGender as any) || 'other',
              bio: pendingBio || 'Passionate about healthy eating and sharing food experiences!',
              createdAt: new Date().toISOString(),
              points: 0,
              streak: 0,
              dailyLikesCount: 0,
              dailyCommentsCount: 0,
              dailyPostsCount: 0,
              referralCode: currentUser.uid.slice(0, 8).toUpperCase(),
              referralsCount: 0,
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              isCreator: false,
              failedScanCount: 0,
              walletAddress: pendingWallet || undefined,
            };
            
            // Remove any undefined fields just in case
            const cleanProfile = Object.fromEntries(
              Object.entries(newProfile).filter(([_, v]) => v !== undefined)
            );

            try {
              await setDoc(userRef, cleanProfile);
              // Also create username document
              await setDoc(doc(db, 'usernames', newProfile.username), { uid: currentUser.uid });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${currentUser.uid}`);
            }
            setProfile(newProfile);
            
            if (pendingUsername) localStorage.removeItem(`pending_username_${currentUser.uid}`);
            if (pendingWallet) localStorage.removeItem(`pending_wallet_${currentUser.uid}`);
            if (pendingGender) localStorage.removeItem(`pending_gender_${currentUser.uid}`);
            if (pendingBio) localStorage.removeItem(`pending_bio_${currentUser.uid}`);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      login: loginWithGoogle, 
      loginWithEmail,
      registerWithEmail,
      loginWithWallet,
      logout, 
      refreshProfile,
      updateUsername,
      updateDisplayName
    }}>
      {children}
    </AuthContext.Provider>
  );
};
