export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RefreshPayload {
  refresh: string;
}

export interface AccessTokenResponse {
  access: string;
}
