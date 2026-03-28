import { getNormalizedLlmRequest, setNormalizedLlmRequest } from "../llm/context.js";
import { normalizeLlmRequest } from "../llm/normalized-request.js";
import type { PluginContext, PluginDefinition } from "../types.js";

export const LlmInboundAnthropicPlugin: PluginDefinition = {
  name: "llm-inbound-anthropic",
  version: "1.0.0",
  displayName: "LLM Inbound Anthropic",
  description: "Normalize Anthropic messages requests before routing.",
  priority: 719,
  phases: ["access"],

  onAccess: (ctx: PluginContext): void => {
    if (getNormalizedLlmRequest(ctx.shared)) {
      return;
    }

    if (!ctx.request.url.pathname.startsWith("/v1/messages")) {
      return;
    }

    setNormalizedLlmRequest(ctx.shared, normalizeLlmRequest(ctx.request, "claude"));
  },
};
