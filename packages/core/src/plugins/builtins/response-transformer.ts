import type { PluginContext, PluginDefinition } from "../types.js";
import {
  applyResponseTransformations,
  responseTransformerConfigDescriptor,
} from "./transformer-shared.js";

export const ResponseTransformerPlugin: PluginDefinition = {
  name: "response-transformer",
  version: "1.0.0",
  displayName: "Response Transformer",
  description: "Mutate response headers and JSON body fields before returning them.",
  priority: 800,
  phases: ["response"],
  configDescriptor: responseTransformerConfigDescriptor,

  onResponse: (ctx: PluginContext): void => {
    applyResponseTransformations(ctx);
  },
};
