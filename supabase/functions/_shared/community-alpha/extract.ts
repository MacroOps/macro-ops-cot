// AI extraction via the Lovable AI Gateway Messages endpoint (Anthropic format).
// Forced tool = structured output. Streams the response. Never logs prompt content.
import type { CaChannel } from "./config.ts";
import { type SlackMessage, summarizeAttachments } from "./filters.ts";
import type { RawIdea } from "./validate.ts";
import { tsToPtIso } from "./validate.ts";

export const CA_MODEL = "anthropic/claude-sonnet-5";
const URL = "https://ai.gateway.lovable.dev/v1/messages";
const TOOL = "record_ideas";

export function buildPrompt(channel: CaChannel): string {
  const general = channel.strict ? "\nIn this channel, keep ONLY clear ticker + direction calls." : "";
  return `You extract long-term trade ideas from one week of Macro Ops community Slack messages in channel ${channel.name}. Messages are given as JSON with message_ts, thread_ts, author_id, author_name, posted_at_iso, text, and attachments (a short list of attached files and link previews, for example "image: chart.png" or "link: <page title>"). Thread replies are grouped under the post they answer. Messages marked context_only are there only as background for a thread (for example a thread's first post from before this week); never use them as the source of an idea.

A trade idea is either:
- Ticker + direction: a named instrument (equity, ETF, index, future, FX pair, commodity, country, crypto) plus a direction (long, short, buy, bullish, bearish, calls, puts, adding), or
- A thesis post: a substantive argument for a position, even without price levels.
Look for long-term, high-conviction ideas. New entries and adds to a position count as ideas. Chart-based calls count as ideas too: tag them with technical (below) instead of dropping them. Outside #general, a post that is only a ticker and an attached chart, with no words about the view, is a bullish technical idea. If the text gives any view, follow the text. It's bearish only when the author says the price is likely to fall or that they'd avoid or short it (for example "lower highs", "rolling over", "breaking down", "I'd stay away"). Doubts or questions about a news item are not a bearish call.${general}

Drop pure tactical position-management updates with no new directional thesis: trims, partial or full profit-taking, stop-outs, "out of all my trades", and any pure exit, cover, or close. Keep substantive bearish-thesis posts even if they mention trimming. Also ignore emoji-only messages, GIFs or images with no text, bare links without commentary, questions without a thesis, and generic chatter.

If one author's idea spans several messages, return ONE idea. If the latest state of that chain is a trim or exit only, return nothing for it. Set message_ts to the message where the ticker or company in the idea is named most explicitly; if several name it, use the earliest. Never pick a message that doesn't mention the ticker or company. message_ts must be one of the message_ts values provided.

In tickers, list every ticker, instrument, or theme the post names for that idea, not only the main one. A post that lists several new positions or adds (for example a weekly trades update) is one idea with all of them in tickers. Instruments that share the same view in one post (for example corn, soybeans, soybean meal and soybean oil) are one idea, not several.

Set technical = true when the ONLY stated basis is price action or positioning: chart patterns, breakouts, moving averages, momentum or relative strength, volatility setups, COT/sentiment/crowding, "chart attached", or a technician's read with no other reason. Buying a dip or a pullback is a price-action reason. Set technical = false if the post gives at least one fundamental or macro reason (valuation, earnings, supply/demand, policy, a catalyst, a structural theme), even if a chart is also cited. Position updates with no stated basis are false.

Direction precision is critical: never flip long/short, and never label a trim as an entry. Direction always refers to the first instrument in tickers, so list the instrument the post is mainly about first, and describe views on the other instruments in the one-liner. For example, "dollar breaking out, bad for gold" is bullish, with the dollar listed first. For relative views ("prefer A over B", "long A, short B"), list the preferred instrument first; its direction is long or bullish. For options or volatility trades, the instrument is the underlying or its volatility, and the direction is the view on it (selling volatility is bearish on volatility). For each idea, set direction_quote to a short verbatim phrase (15 words or fewer) from the source message that shows the author's view on the first instrument, or "chart only" for a ticker-plus-chart post with no words about the view. If you can't tell the direction of an idea, drop that idea.

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
        required: ["message_ts", "author_id", "author_name", "idea_type", "tickers", "direction", "label", "one_liner", "technical", "direction_quote"],
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
          direction_quote: { type: "string", description: "verbatim phrase <= 15 words from the source message, or \"chart only\"" },
        },
      },
    },
    tactical_dropped: { type: "integer" },
  },
};

export interface AiIdea {
  message_ts: string; author_id: string; author_name: string; idea_type: string;
  tickers: string; direction: string; label: string; one_liner: string; technical: boolean;
  direction_quote: string;
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

/**
 * Thread-grouped payload: each thread is sent as a unit (parent, then its replies in order),
 * threads ordered by their first message. A parent from before the window is included once,
 * marked context_only: true, only as background.
 */
export function messagesPayload(
  msgs: SlackMessage[],
  names: Map<string, string>,
  contextParents: SlackMessage[] = [],
): string {
  const byTs = new Map(msgs.map((m) => [m.ts, m]));
  const ctx = new Map(contextParents.map((m) => [m.ts, m]));
  const rootOf = (m: SlackMessage) => (m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : m.ts);
  const groups = new Map<string, SlackMessage[]>();
  for (const m of [...msgs].sort((a, b) => Number(a.ts) - Number(b.ts))) {
    const r = rootOf(m);
    if (!groups.has(r)) groups.set(r, []);
    if (r !== m.ts) groups.get(r)!.push(m);
  }
  const row = (m: SlackMessage, contextOnly: boolean) => ({
    message_ts: m.ts,
    thread_ts: m.thread_ts ?? null,
    author_id: m.user,
    author_name: names.get(m.user!) ?? m.user,
    posted_at_iso: tsToPtIso(m.ts),
    text: m.text ?? "",
    attachments: summarizeAttachments(m),
    context_only: contextOnly,
  });
  const out: ReturnType<typeof row>[] = [];
  for (const [root, replies] of groups) {
    const parent = byTs.get(root);
    if (parent) out.push(row(parent, false));
    else if (ctx.has(root)) out.push(row(ctx.get(root)!, true));
    for (const r of replies) out.push(row(r, false));
  }
  return JSON.stringify(out);
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
    direction_quote: a.direction_quote,
  };
}

// ---------- Second pass: direction check ----------
const CHECK_TOOL = "record_checks";
const CHECK_PROMPT = `You check trade ideas extracted from Slack posts. For each item you get an id, the first instrument, the extracted direction (long, short, bullish, bearish or buy; long, bullish and buy all mean the author expects the instrument to rise), a quoted phrase, and the full source message text. Answer one question per item: does the author's view on the first instrument match this direction? Answer "yes", "no", or "unclear". Judge the author's view on that instrument only, not on other instruments in the post. A ticker-plus-chart post with no words about the view counts as bullish. Give a short reason (<= 15 words).`;
const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["checks"],
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "answer", "reason"],
        properties: {
          id: { type: "integer" },
          answer: { type: "string", enum: ["yes", "no", "unclear"] },
          reason: { type: "string" },
        },
      },
    },
  },
};
export interface CheckItem { id: number; instrument: string; direction: string; direction_quote: string; source_text: string }
export interface CheckResult { answers: Map<number, { answer: string; reason: string }>; input_tokens: number; output_tokens: number }

export async function checkDirections(apiKey: string, items: CheckItem[], model: string = CA_MODEL): Promise<CheckResult> {
  const r = await callForcedTool(apiKey, model, CHECK_PROMPT, JSON.stringify(items), CHECK_TOOL, "Record the direction checks.", CHECK_SCHEMA, 4000);
  const answers = new Map<number, { answer: string; reason: string }>();
  for (const c of r.parsed.checks ?? []) answers.set(Number(c.id), { answer: String(c.answer), reason: String(c.reason ?? "") });
  return { answers, input_tokens: r.inTok, output_tokens: r.outTok };
}

async function callForcedTool(
  apiKey: string, model: string, system: string, user: string,
  tool: string, desc: string, schema: unknown, maxTokens: number,
) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json", "anthropic-version": "2023-06-01", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true, system,
      messages: [{ role: "user", content: user }],
      tools: [{ name: tool, description: desc, input_schema: schema }],
      tool_choice: { type: "tool", name: tool },
    }),
  });
  if (!res.ok) throw new AiError(res.status, (await res.text()).slice(0, 500));
  let json = "", inTok = 0, outTok = 0, stop = "";
  await readSse(res, (ev) => {
    if (ev.type === "message_start") inTok = ev.message?.usage?.input_tokens ?? 0;
    if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta") json += ev.delta.partial_json;
    if (ev.type === "message_delta") { outTok = ev.usage?.output_tokens ?? outTok; stop = ev.delta?.stop_reason ?? stop; }
    if (ev.type === "error") throw new AiError(500, JSON.stringify(ev.error).slice(0, 300));
  });
  if (!json) throw new AiError(502, `empty output (stop_reason=${stop})`);
  return { parsed: JSON.parse(json), inTok, outTok };
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
  model: string = CA_MODEL,
  contextParents: SlackMessage[] = [],
): Promise<ExtractResult> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 16000,
    stream: true,
    system: buildPrompt(channel),
    messages: [{ role: "user", content: messagesPayload(msgs, names, contextParents) }],
  };
  if (method === "forced_tool") {
    body.tools = [{ name: TOOL, description: "Record the extracted ideas.", input_schema: OUTPUT_SCHEMA }];
    body.tool_choice = { type: "tool", name: TOOL };
  } else {
    body.output_config = { format: { type: "json_schema", schema: OUTPUT_SCHEMA } };
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
