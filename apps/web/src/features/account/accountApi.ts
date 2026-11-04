import type { LineConfig } from '@bella/domain';
import { API_URL } from '../../lib/api';

export interface Reward {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface HistoryEntry {
  points: number;
  kind: 'earn' | 'redeem';
  description: string;
  orderCode?: string | null;
  voucherCode?: string | null;
  createdAt: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  twoFactor: boolean;
  memberSince: string;
  /* Devices signed in to this account, this one included. */
  sessions: number;
  points: number;
  history: HistoryEntry[];
  rewards: Reward[];
}

export type CodePurpose = 'verify' | 'login' | 'reset';

export interface CodeSent {
  needsVerification: true;
  purpose: CodePurpose;
  email: string;
  maskedEmail: string;
  expiresInSeconds: number;
  resendInSeconds: number;
  devCode?: string | null;
}

export interface SignedIn {
  token: string;
  profile: Profile;
}

/* Errors keep the per field messages the API returns for the sign up form. */
export class AccountError extends Error {
  status: number;
  fields: Record<string, string>;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.fields = (data.fields as Record<string, string>) ?? {};
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...rest.headers
    },
    signal: rest.signal ?? AbortSignal.timeout(20000)
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AccountError((data.error as string) ?? 'Não foi possível concluir agora.', res.status, data);
  return data as T;
}

const post = <T>(path: string, body: unknown, token?: string | null) => call<T>(path, { method: 'POST', body: JSON.stringify(body), token });

export const accountApi = {
  register: (body: { name: string; email: string; phone: string; password: string }) => post<CodeSent>('/api/auth/register', body),
  login: (body: { email: string; password: string }) => post<CodeSent | SignedIn>('/api/auth/login', body),
  verify: (email: string, code: string) => post<SignedIn>('/api/auth/verify', { email, code }),
  resend: (email: string) => post<CodeSent>('/api/auth/resend', { email }),
  logout: (token: string) => post<void>('/api/auth/logout', {}, token),
  forgot: (email: string) => post<CodeSent>('/api/auth/forgot', { email }),
  reset: (email: string, code: string, password: string) => post<SignedIn>('/api/auth/reset', { email, code, password }),
  updateProfile: (token: string, body: { name: string; phone: string }) => post<Profile>('/api/me/profile', body, token),
  changePassword: (token: string, body: { currentPassword: string; newPassword: string }) => post<Profile>('/api/me/password', body, token),
  setTwoFactor: (token: string, enabled: boolean, password: string) => post<Profile>('/api/me/two-factor', { enabled, password }, token),
  endOtherSessions: (token: string) => post<Profile>('/api/me/sessions/end-others', {}, token),
  deleteAccount: (token: string, password: string) => post<void>('/api/me/delete', { password }, token),
  me: (token: string) => call<Profile>('/api/me', { token }),
  earn: (token: string, orderCode: string, lines: LineConfig[]) =>
    post<{ earned: number; profile: Profile }>('/api/loyalty/earn', { orderCode, lines }, token),
  redeem: (token: string, rewardId: string) =>
    post<{ voucher: string; reward: Reward; profile: Profile }>('/api/loyalty/redeem', { rewardId }, token)
};

export const isCodeSent = (r: CodeSent | SignedIn): r is CodeSent => 'needsVerification' in r;
