import { NextRequest, NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line/webhook";
import { handleMessage } from "@/lib/line/message-handler";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify signature
    const signature = request.headers.get("x-line-signature") ?? "";
    if (!verifyLineSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as { events?: LineEvent[] };
    const events = body.events ?? [];

    // Process events (fire-and-forget — LINE expects 200 quickly)
    for (const event of events) {
      if (
        event.type === "message" &&
        event.message?.type === "text" &&
        event.message.text &&
        event.source?.userId
      ) {
        await handleMessage(
          event.source.userId,
          event.message.text,
          event.replyToken
        );
      }
    }

    // LINE requires 200 OK regardless of processing outcome
    return NextResponse.json({ ok: true });
  } catch {
    // Always return 200 to LINE to prevent retries
    return NextResponse.json({ ok: true });
  }
}
