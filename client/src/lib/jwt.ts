export type JwtPayload = Record<string, any> | null;

function base64UrlToBase64(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad === 2) str += '==';
  else if (pad === 3) str += '=';
  else if (pad !== 0) str += '===';
  return str;
}

function decodeBase64(b64: string): string {
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(b64);
  }
  const BufferCtor = (globalThis as any).Buffer ?? require('buffer').Buffer;
  return BufferCtor.from(b64, 'base64').toString('utf8');
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadB64Url = parts[1];
    const payloadB64 = base64UrlToBase64(payloadB64Url);
    const json = decodeBase64(payloadB64);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export const parseJwt = decodeJwtPayload;

export function parseJwtExpiry(token: string | null | undefined): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const exp = payload.exp;
  if (typeof exp === 'number') return exp;
  if (typeof exp === 'string' && /^\d+$/.test(exp)) return parseInt(exp, 10);
  return null;
}

export function getJwtExpiryDate(token: string | null | undefined): Date | null {
  const exp = parseJwtExpiry(token);
  return exp ? new Date(exp * 1000) : null;
}

export function isJwtExpired(token: string | null | undefined, leewaySeconds = 0): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}
