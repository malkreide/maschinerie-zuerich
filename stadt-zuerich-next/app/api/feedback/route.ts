import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;

    // Log the feedback locally for development/debugging
    console.log('[Feedback API] Received feedback:', body);

    if (webhookUrl) {
      // Forward to webhook if configured
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...body,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        console.error('[Feedback API] Webhook failed:', response.status, response.statusText);
        // We still return 200 to the client so the UI shows "Thanks",
        // even if the backend webhook integration is temporarily down.
      }
    } else {
      console.log('[Feedback API] No FEEDBACK_WEBHOOK_URL configured. Feedback was only logged locally.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Feedback API] Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
