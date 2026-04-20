import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware Drop-In-Ersatz für next/link & next/navigation.
// Components importieren von hier statt direkt von 'next/link' etc.,
// damit Hrefs automatisch das aktive Locale-Prefix bekommen.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
