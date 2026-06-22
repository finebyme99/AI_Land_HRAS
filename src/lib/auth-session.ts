export const AUTH_SESSION_MAX_AGE_DAYS = 30;
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * AUTH_SESSION_MAX_AGE_DAYS;

interface AuthSessionCookieOptionsInput {
  httpOnly: boolean;
  secure?: boolean;
}

interface AuthSessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
}

export function getAuthSessionCookieOptions(input: AuthSessionCookieOptionsInput): AuthSessionCookieOptions {
  return {
    httpOnly: input.httpOnly,
    secure: input.secure ?? process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  };
}
