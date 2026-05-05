// MusicBridge — Auth state context.
// Subscribes to Firebase Auth + reads the user's role doc from Firestore.
// Routes consumers based on `{user, role, teacherId}`.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserDoc, Role } from './types';

interface AuthState {
  loading: boolean;
  user: User | null;
  userDoc: UserDoc | null;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  user: null,
  userDoc: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user]);

  return (
    <AuthContext.Provider value={{ loading, user, userDoc }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function useRequireRole(expected: Role): { ok: boolean; loading: boolean } {
  const { loading, userDoc } = useAuth();
  return { ok: userDoc?.role === expected, loading };
}
