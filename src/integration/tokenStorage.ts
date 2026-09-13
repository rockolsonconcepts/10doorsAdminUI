import { TokenResponse } from '@/model/TokenResponse';

const USER_TOKEN_KEY = 'ten_doors_admin_user_token';
const CLIENT_TOKEN_KEY = 'ten_doors_admin_client_token';

function read(key: string): TokenResponse | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as TokenResponse;
    return typeof obj.accessToken === 'string' && typeof obj.creationTimestamp === 'number' ? obj : null;
  } catch {
    return null;
  }
}

export const TokenStorage = {
  getUserToken: () => read(USER_TOKEN_KEY),
  persistUserToken: (t: TokenResponse) => localStorage.setItem(USER_TOKEN_KEY, JSON.stringify(t)),
  removeUserToken: () => localStorage.removeItem(USER_TOKEN_KEY),
  getClientToken: () => read(CLIENT_TOKEN_KEY),
  persistClientToken: (t: TokenResponse) => localStorage.setItem(CLIENT_TOKEN_KEY, JSON.stringify(t)),
  removeClientToken: () => localStorage.removeItem(CLIENT_TOKEN_KEY),
  clear: () => {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  },
};
