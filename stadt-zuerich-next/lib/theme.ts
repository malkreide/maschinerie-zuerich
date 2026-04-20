// Cookie-basierte Theme-Persistenz.
// Server liest das Cookie beim Render → setzt die <html>-Klasse direkt
// in der HTML-Antwort → kein Flash-of-Wrong-Theme beim ersten Paint.

import { cookies } from 'next/headers';

export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'mog-theme';
export const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 Jahr

export async function getTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  return cookieStore.get(THEME_COOKIE)?.value === 'dark' ? 'dark' : 'light';
}
