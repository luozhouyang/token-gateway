import type { PluginContext, PluginDefinition } from "../types.js";
import {
  applyRequestTransformations,
  requestTransformerConfigDescriptor,
} from "./transformer-shared.js";

export const RequestTransformerPlugin: PluginDefinition = {
  name: "request-transformer",
  version: "1.0.0",
  displayName: "Request Transformer",
  description: "Mutate request headers, query parameters, body fields, and path templates.",
  priority: 801,
  phases: ["access"],
  configDescriptor: requestTransformerConfigDescriptor,

  onAccess: (ctx: PluginContext): void => {
    applyRequestTransformations(ctx);
  },
};
