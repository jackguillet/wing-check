import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? "NOT SET";

  if (!hasKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set", keyPrefix });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 64,
      messages: [{ role: "user", content: "Say hello in 5 words." }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ success: true, keyPrefix, text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, keyPrefix, error: message });
  }
}
