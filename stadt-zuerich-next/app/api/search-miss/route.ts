// Nimmt anonyme Nulltreffer-Suchbegriffe entgegen (Backlog-Signal).
//
// Privacy-by-design:
//  - Es werden KEINE IP, User-Agent, Cookies oder Sessions gespeichert.
//  - Der Begriff läuft durch normalizeMissQuery() und wird verworfen, wenn er
//    wie Personendaten aussieht (E-Mail, lange Ziffernfolgen) oder zu kurz/lang
//    ist. Verworfene Begriffe werden nicht protokolliert.
//  - Best-effort Rate-Limit pro Prozess gegen Missbrauch/Spam.
//  - Zielsenke ist ein optionaler Webhook (SEARCH_MISS_WEBHOOK_URL); ohne
//    Webhook nur lokales console.log für Entwicklung.

import { NextResponse } from 'next/server';
import { normalizeMissQuery } from '@/lib/search-miss';

// Sliding-Window-Rate-Limit (best effort, pro Server-Instanz). In einer
// serverlosen Umgebung kann es mehrere Instanzen geben — das ist ok, weil
// es nur grobe Missbrauchs-Spitzen kappen, nicht exakt zählen soll.
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
    const q = normalizeMissQuery(body?.q);
    // Verworfen (PII-Verdacht / zu kurz / zu lang) → nichts protokollieren.
    if (!q) return NextResponse.json({ ok: false, reason: 'dropped' });

    const locale =
      typeof body?.locale === 'string' ? body.locale.slice(0, 5) : undefined;
    const record = { q, locale, ts: new Date().toISOString() };

    const webhookUrl = process.env.SEARCH_MISS_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch((err) => {
        console.error('[search-miss] Webhook fehlgeschlagen:', err);
      });
    } else {
      console.log('[search-miss]', record);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[search-miss] Fehler:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
