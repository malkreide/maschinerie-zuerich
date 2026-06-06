// Nimmt Micro-Feedback entgegen — privacy-by-design.
//
//  - KEINE IP, User-Agent, Cookies oder Sessions werden gespeichert.
//  - Freitext-Kommentar läuft durch sanitizeFeedbackComment() (E-Mails und
//    längere Ziffernfolgen werden geschwärzt, Länge gekappt).
//  - Kategorie wird gegen eine feste Whitelist geprüft.
//  - Honeypot-Feld ('website') gegen Bots: gefüllt → still verwerfen.
//  - Best-effort Rate-Limit pro Prozess gegen Spam.
//  - Zielsenke ist optional FEEDBACK_WEBHOOK_URL; sonst lokales Log.

import { NextResponse } from 'next/server';
import { sanitizeFeedbackComment, isFeedbackCategory } from '@/lib/feedback';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
let windowStart = Date.now();
let windowCount = 0;

function rateLimitOk(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= MAX_PER_WINDOW) return false;
  windowCount += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    if (!rateLimitOk()) {
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
    }

    const body = await request.json().catch(() => null);

    // Honeypot: echte Nutzer:innen sehen das Feld nicht. Ist es gefüllt,
    // tun wir so, als sei alles ok, speichern aber nichts.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true });
    }

    const helpful = typeof body?.helpful === 'boolean' ? body.helpful : undefined;
    const category = isFeedbackCategory(body?.category) ? body.category : undefined;
    const comment = sanitizeFeedbackComment(body?.comment);
    const contextId =
      typeof body?.contextId === 'string' ? body.contextId.slice(0, 64) : undefined;
    const locale = typeof body?.locale === 'string' ? body.locale.slice(0, 5) : undefined;

    // Mindestens ein verwertbares Signal muss vorhanden sein.
    if (helpful === undefined && !category && !comment) {
      return NextResponse.json({ ok: false, reason: 'empty' });
    }

    // Bewusst KEINE IP/User-Agent/Session.
    const record = { helpful, category, comment, contextId, locale, ts: new Date().toISOString() };

    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch((err) => {
        console.error('[feedback] Webhook fehlgeschlagen:', err);
      });
    } else {
      console.log('[feedback]', record);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[feedback] Fehler:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
