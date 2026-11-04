import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { local } from '../../lib/storage';
import { accountApi, AccountError, type Profile } from './accountApi';

const KEY = 'bm-session';

export type AuthMode = 'login' | 'register' | 'forgot';

interface AuthRequest {
  /* Short line shown on top of the sheet, such as "Entre para ganhar 85 pontos". */
  reason?: string;
  /* Where the sheet opens; "forgot" starts the password reset. */
  mode?: AuthMode;
  email?: string;
  onSuccess?: (profile: Profile) => void;
}

interface AccountApi {
  token: string | null;
  profile: Profile | null;
  loading: boolean;
  signIn(token: string, profile: Profile): void;
  signOut(): Promise<void>;
  /* Forgets the session on this device only, as after deleting the account. */
  forget(): void;
  refresh(): Promise<void>;
  setProfile(profile: Profile): void;
  /* Opens the sign in sheet over the current page; nothing on the page is lost. */
  openAuth(request?: AuthRequest): void;
  closeAuth(): void;
  authRequest: AuthRequest | null;
}

const AccountContext = createContext<AccountApi | null>(null);

function readToken() {
  try {
    return local?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) local?.setItem(KEY, token);
    else local?.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [authRequest, setAuthRequest] = useState<AuthRequest | null>(null);
  const requestRef = useRef<AuthRequest | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setProfile(await accountApi.me(token));
    } catch (error) {
      // An expired session signs out; a sleeping API keeps the token for later.
      if (error instanceof AccountError && error.status === 401) {
        writeToken(null);
        setToken(null);
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback((next: string, nextProfile: Profile) => {
    writeToken(next);
    setToken(next);
    setProfile(nextProfile);
    setLoading(false);
    requestRef.current?.onSuccess?.(nextProfile);
    requestRef.current = null;
    setAuthRequest(null);
  }, []);

  const signOut = useCallback(async () => {
    const current = token;
    writeToken(null);
    setToken(null);
    setProfile(null);
    if (current) await accountApi.logout(current).catch(() => {});
  }, [token]);

  const forget = useCallback(() => {
    writeToken(null);
    setToken(null);
    setProfile(null);
  }, []);

  const openAuth = useCallback((request: AuthRequest = {}) => {
    requestRef.current = request;
    setAuthRequest(request);
  }, []);

  const closeAuth = useCallback(() => {
    requestRef.current = null;
    setAuthRequest(null);
  }, []);

  const value = useMemo<AccountApi>(() => ({
    token, profile, loading, signIn, signOut, forget, refresh, setProfile, openAuth, closeAuth, authRequest
  }), [token, profile, loading, signIn, signOut, forget, refresh, openAuth, closeAuth, authRequest]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount fora do AccountProvider');
  return ctx;
}
