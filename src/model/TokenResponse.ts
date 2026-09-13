export type TokenType = 'BEARER';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  scope: string;
  tokenType: TokenType;
  creationTimestamp: number;
}

export function parseTokenResponse(raw: unknown): TokenResponse {
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj?.accessToken !== 'string' ||
    typeof obj?.expiresIn !== 'number' ||
    typeof obj?.refreshToken !== 'string' ||
    typeof obj?.creationTimestamp !== 'number'
  ) {
    throw new Error('Unexpected token response shape');
  }
  return {
    accessToken: obj.accessToken,
    expiresIn: obj.expiresIn,
    refreshToken: obj.refreshToken,
    scope: typeof obj.scope === 'string' ? obj.scope : '',
    tokenType: 'BEARER',
    creationTimestamp: obj.creationTimestamp,
  };
}

export function isExpired(token: TokenResponse, skewSeconds = 30): boolean {
  return Date.now() >= token.creationTimestamp + (token.expiresIn - skewSeconds) * 1000;
}
