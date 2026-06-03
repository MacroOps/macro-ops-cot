// Lovable AI Gateway-backed chat for the Research Copilot.
// Streams plain text back to the client.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `You are the Macro HUD Research Copilot — an institutional-grade quant assistant embedded in a market-positioning & turning-point research terminal.
You help the user reason about CoT positioning extremes, trend fragility, risk cycle, breadth & thrusts, market internals, macro regime (growth/liquidity/inflation/recession), and TurningPoint TCTM composites.

Style:
- Terse, analytical, bullet-driven. No filler, no apologies.
- When given chart/indicator context (title, current value, thresholds, recent series), reference it directly with numbers.
- When asked for backtest stats and a backtest tool result is provided in the conversation, summarize it crisply with hit-rate, average forward return, and the regime where it works.
- Flag asymmetric risk/reward, divergences, and crowding.
- If you don't have data, say what data you'd need; never fabricate prices.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = context
      ? `${SYSTEM_PROMPT}\n\nACTIVE CHART CONTEXT:\n${JSON.stringify(context, null, 2)}`
      : SYSTEM_PROMPT;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: "Upstream error", status: upstream.status, body: text }), {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Re-stream as plain text (extract delta.content from SSE chunks).
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              const data = l.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {/* skip */}
            }
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
