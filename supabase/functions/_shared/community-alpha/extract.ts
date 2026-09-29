// AI extraction via the Lovable AI Gateway Messages endpoint (Anthropic format).
// Forced tool = structured output. Streams the response. Never logs prompt content.
import type { CaChannel } from "./config.ts";
import type { SlackMessage } from "./filters.ts";
import type { RawIdea } from "./validate.ts";
import { tsToPtIso } from "./validate.ts";

export const CA_MODEL = "anthropic/claude-sonnet-5";
const URL = "https://ai.gateway.lovable.dev/v1/messages";
const TOOL = "record_ideas";

export function buildPrompt(channel: CaChannel): string {
  const general = channel.strict ? "\nKeep ONLY explicit ticker + direction calls." : "";
  return `You extract long-term trade ideas from one week of Macro Ops community Slack messages in channel ${channel.name}. Messages are given as JSON with message_ts, thread_ts, author_id, author_name, posted_at_iso, and text.

Keep a message only if it is:
- Ticker + direction: a named instrument (equity, index, future, FX pair, commodity, country, crypto) plus a direction (long, short, buy, bullish, bearish, calls, puts, adding), or
- A thesis post: a substantive argument for a position, even without price levels.
The goal is long-term, high-conviction ideas. Prefer reasoning, valuation, and catalysts over chart-only calls.${general}

Drop: pure position management (trims, profit-taking, stop-outs, exits, "back in X") with no new thesis; emoji-only; images with no text; bare links without commentary; questions without a thesis; general market chatter; announcements. Keep a multi-paragraph bearish thesis even if it mentions trimming.

If one author's idea spans several messages, return ONE idea. If the chain ends in a trim or exit only, return nothing for it. Set message_ts to the message that names the ticker or company most explicitly (the earliest if several do). Never pick a message that does not mention the ticker or company. message_ts must be one of the message_ts values provided.

Set technical = true when the ONLY stated basis is price action or positioning: chart patterns, breakouts, moving averages, momentum or relative strength, volatility setups, COT/sentiment/crowding, "chart attached", or a technician's read with no other reason. Set technical = false if the post gives at least one fundamental or macro reason (valuation, earnings, supply/demand, policy, a catalyst, a structural theme), even if a chart is also cited. Position updates with no stated basis are false. Technical ideas are kept, not dropped.

Never flip long/short, and never label a trim as an entry. If unsure, drop the message.

Return ideas plus tactical_dropped = the number of pure position-management messages you dropped.`;
}

export const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas", "tactical_dropped"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["message_ts", "author_id", "author_name", "idea_type", "tickers", "direction", "label", "one_liner", "technical"],
        properties: {
          message_ts: { type: "string" },
          author_id: { type: "string" },
          author_name: { type: "string" },
          idea_type: { type: "string", enum: ["ticker+direction", "thesis"] },
          tickers: { type: "string" },
          direction: { type: "string", enum: ["long", "short", "bullish", "bearish", "buy"] },
          label: { type: "string", description: "<= 8 words" },
          one_liner: { type: "string", description: "<= 25 words" },
          technical: { type: "boolean" },
        },
      },
    },
    tactical_dropped: { type: "integer" },
  },
};

export interface AiIdea {
  message_ts: string; author_id: string; author_name: string; idea_type: string;
  tickers: string; direction: string; label: string; one_liner: string; technical: boolean;
}
export interface ExtractResult {
  ideas: AiIdea[];
  tactical_dropped: number;
  input_tokens: number;
  output_tokens: number;
  method: "forced_tool" | "json_schema";
  runId?: string;
}

export class AiError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export function messagesPayload(msgs: SlackMessage[], names: Map<string, string>): string {
  return JSON.stringify(msgs.map((m) => ({
    message_ts: m.ts,
    thread_ts: m.thread_ts ?? null,
    author_id: m.user,
    author_name: names.get(m.user!) ?? m.user,
    posted_at_iso: tsToPtIso(m.ts),
    text: m.text ?? "",
  })));
}

/** Map AI output to the validator's RawIdea shape. */
export function toRawIdea(a: AiIdea): RawIdea {
  return {
    source_ts: a.message_ts,
    author_id: a.author_id,
    idea_type: a.idea_type,
    tickers: String(a.tickers ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    direction: a.direction,
    label: a.label,
    one_liner: a.one_liner,
    technical: a.technical,
  };
}

async function readSse(res: Response, onEvent: (ev: any) => void) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data:")) {
          const d = line.slice(5).trim();
          if (d && d !== "[DONE]") onEvent(JSON.parse(d));
        }
      }
    }
  }
}

export async function extractIdeas(
  apiKey: string,
  channel: CaChannel,
  msgs: SlackMessage[],
  names: Map<string, string>,
  method: "forced_tool" | "json_schema" = "forced_tool",
): Promise<ExtractResult> {
  const body: Record<string, unknown> = {
    model: CA_MODEL,
    max_tokens: 16000,
    stream: true,
    system: buildPrompt(channel),
    messages: [{ role: "user", content: messagesPayload(msgs, names) }],
  };
  if (method === "forced_tool") {
    body.tools = [{ name: TOOL, description: "Record the extracted ideas.", input_schema: OUTPUT_SCHEMA }];
    body.tool_choice = { type: "tool", name: TOOL };
  } else {
    body.output_format = { type: "json_schema", schema: OUTPUT_SCHEMA };
  }
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });
  const runId = res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
  if (!res.ok) {
    const t = await res.text();
    throw new AiError(res.status, t.slice(0, 500));
  }
  let json = "", text = "", inTok = 0, outTok = 0, stop = "";
  await readSse(res, (ev) => {
    if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens ?? 0;
    if (ev.type === "content_block_delta") {
      if (ev.delta?.type === "input_json_delta") json += ev.delta.partial_json;
      if (ev.delta?.type === "text_delta") text += ev.delta.text;
    }
    if (ev.type === "message_delta") { outTok = ev.usage?.output_tokens ?? outTok; stop = ev.delta?.stop_reason ?? stop; }
    if (ev.type === "error") throw new AiError(500, JSON.stringify(ev.error).slice(0, 300));
  });
  const raw = method === "forced_tool" ? json : text;
  if (!raw) throw new AiError(502, `empty output (stop_reason=${stop})`);
  const parsed = JSON.parse(raw);
  return {
    ideas: parsed.ideas ?? [],
    tactical_dropped: Number(parsed.tactical_dropped ?? 0),
    input_tokens: inTok,
    output_tokens: outTok,
    method,
    runId,
  };
}
