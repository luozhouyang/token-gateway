import { getNormalizedLlmRequest, setNormalizedLlmRequest } from "../llm/context.js";
import { normalizeLlmRequest } from "../llm/normalized-request.js";
import type { LlmClientProfile } from "../llm/types.js";
import type { PluginContext, PluginDefinition } from "../types.js";

export const LlmInboundOpenAIPlugin: PluginDefinition = {
  name: "llm-inbound-openai",
  version: "1.0.0",
  displayName: "LLM Inbound OpenAI",
  description: "Normalize OpenAI-compatible inbound requests before routing.",
  priority: 720,
  phases: ["access"],

  onAccess: (ctx: PluginContext): void => {
    if (getNormalizedLlmRequest(ctx.shared)) {
      return;
    }

    const clientProfile = resolveOpenAiClientProfile(ctx.request.url.pathname);
    if (!clientProfile) {
      return;
    }

    setNormalizedLlmRequest(ctx.shared, normalizeLlmRequest(ctx.request, clientProfile));
  },
};

function resolveOpenAiClientProfile(pathname: string): LlmClientProfile | null {
  if (pathname.startsWith("/v1/responses")) {
    return "codex";
  }

  if (pathname.startsWith("/v1/chat/completions")) {
    return "openai-compatible";
  }

  return null;
}
