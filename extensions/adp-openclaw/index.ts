import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

// ============================================================================
// PERFORMANCE NOTE: This file is the plugin entry point loaded by openclaw at
// startup.  Everything imported at the top level is evaluated **synchronously**
// during plugin discovery, blocking the entire startup sequence.
//
// Heavy modules (session-history, adp-upload-tool, tool-result-message-blocks)
// are therefore NOT imported at the top level.  Instead they are:
//   1. Lazily re-exported via getter helpers (for external consumers).
//   2. Dynamically imported inside register() / tool-execute callbacks.
//
// This keeps register() fast (< 50 ms) and avoids blocking the scan phase.
// ============================================================================

// ---- Lightweight imports (tiny modules, no heavy deps) ----
import { adpOpenclawPlugin, type AdpOpenclawChannelConfig } from "./src/channel.js";
import { setAdpOpenclawRuntime } from "./src/runtime.js";
// Type-only imports are erased at runtime — zero overhead
import type { AdpUploadToolResult, UploadedFileInfo } from "./src/adp-upload-tool.js";

// ---- Tool name / schema constants (inlined to avoid loading full upload module) ----
const ADP_UPLOAD_TOOL_NAME = "adp_upload_file";
const ADP_UPLOAD_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    paths: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Array of 1-10 local file paths to upload",
      minItems: 1,
      maxItems: 10,
    },
    fileType: {
      type: "string" as const,
      description: "Optional MIME type hint for uploaded files",
    },
  },
  required: ["paths"] as const,
};

// Track whether register() has been called at least once (for log dedup)
let _registerCallCount = 0;

// ============================================================================
// Lazy re-exports for external consumers
// These are loaded on first access, not at plugin startup.
// ============================================================================

// Session history (heavy: node:child_process, node:fs, 1100+ lines)
export async function getSessionHistoryModule() {
  return import("./src/session-history.js");
}

// Re-export types (type-only imports are free at runtime)
export type {
  OpenClawSession,
  OpenClawMessage,
  ChatHistoryResponse,
  SessionsListResponse,
  SessionFileConfig,
} from "./src/session-history.js";

// ADP upload tool
export async function getAdpUploadToolModule() {
  return import("./src/adp-upload-tool.js");
}

export type {
  UploadResult,
  AdpUploadToolParams,
  AdpUploadToolResult,
  UploadedFileInfo,
  AdpUploadOptions,
  DescribeRemoteBotStorageCredentialReq,
  DescribeRemoteBotStorageCredentialRsp,
  Credentials,
} from "./src/adp-upload-tool.js";

// Tool result message blocks
export async function getToolResultMessageBlocksModule() {
  return import("./src/tool-result-message-blocks.js");
}

export type {
  ResourceLinkBlock,
  TextBlock,
  ContentBlock,
  MessageBlock,
} from "./src/tool-result-message-blocks.js";

// Helper to format tool result as JSON string
const formatToolResultJson = (result: unknown): string => 
  JSON.stringify(result, null, 2) ?? "upload failed";

const plugin = {
  id: "adp-openclaw",
  name: "ADP OpenClaw",
  description: "ADP channel plugin backed by a Go WebSocket server",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    _registerCallCount++;
    
    // Only log on first registration to avoid flooding logs
    if (_registerCallCount === 1) {
      api.logger.info?.("[adp-openclaw] Plugin register() called");
    }
    
    setAdpOpenclawRuntime(api.runtime);
    
    api.registerTool((ctx: { messageChannel?: string; [key: string]: unknown }) => {
      // Only expose this tool when the message comes from the adp-openclaw channel
      const channel = ctx.messageChannel ?? "";
      if (channel && channel !== "adp-openclaw") {
        return null;
      }

      return {
      name: ADP_UPLOAD_TOOL_NAME,
      description: 
        "If you can see this tool description, you are connected to the ADP server. " +
        "Use this tool to send 1-10 local files of any type (including images and documents) to the user. " +
        "A successful call means the files were uploaded and download URLs are returned. " +
        "IMPORTANT: You MUST include the download URLs in your response to the user, " +
        "and remind the user that the download links are valid for 24 hours. " +
        "Parameters must be local filesystem paths only.",
      parameters: ADP_UPLOAD_TOOL_SCHEMA,
      async execute(toolCallId: string, params: unknown) {
        // Lazy-load the heavy upload module only when the tool is actually invoked
        const {
          parseAdpUploadToolParams,
          uploadFilesToAdpEndpoint,
          uploadResultEmitter,
          UPLOAD_RESULT_EVENT,
        } = await import("./src/adp-upload-tool.js");

        // Get bot token from channel config
        const getClientToken = (): string | undefined => {
          try {
            const cfg = api.runtime?.config?.loadConfig?.();
            const channelCfg = cfg?.channels?.["adp-openclaw"] as AdpOpenclawChannelConfig | undefined;
            return channelCfg?.clientToken?.trim() || process.env.ADP_OPENCLAW_CLIENT_TOKEN;
          } catch {
            return process.env.ADP_OPENCLAW_CLIENT_TOKEN;
          }
        };

        // Parse and validate parameters
        const parsed = parseAdpUploadToolParams(params);
        if (!parsed.ok) {
          const errorResult = {
            ok: false,
            error: formatToolResultJson(parsed.error),
          };
          api.logger.debug?.(`[${ADP_UPLOAD_TOOL_NAME}] validation failed toolCallId=${toolCallId} error=${errorResult.error}`);
          return {
            output: errorResult,
            result: errorResult,
            details: errorResult,
            content: [{ type: "text", text: formatToolResultJson(parsed.error) }],
            isError: true,
          };
        }

        // Get bot token
        const botToken = getClientToken();
        if (!botToken) {
          const errorResult = {
            ok: false,
            error: "missing bot token for file upload - please configure clientToken in adp-openclaw channel settings",
          };
          return {
            output: errorResult,
            result: errorResult,
            details: errorResult,
            content: [{ type: "text", text: errorResult.error }],
            isError: true,
          };
        }

        // Execute upload
        const uploadResult = await uploadFilesToAdpEndpoint(parsed.value.paths, {
          botToken,
          fileType: parsed.value.fileType,
        });

        if (!uploadResult.ok) {
          const errorResult = {
            ok: false,
            error: formatToolResultJson(uploadResult.error),
          };
          api.logger.debug?.(`[${ADP_UPLOAD_TOOL_NAME}] upload failed toolCallId=${toolCallId} error=${errorResult.error}`);
          return {
            output: errorResult,
            result: errorResult,
            details: errorResult,
            content: [{ type: "text", text: formatToolResultJson(uploadResult.error) }],
            isError: true,
          };
        }

        // Success - format result with download URLs
        const successResult: AdpUploadToolResult = {
          ok: true,
          files: uploadResult.files,
        };

        api.logger.debug?.(`[${ADP_UPLOAD_TOOL_NAME}] upload success toolCallId=${toolCallId} count=${successResult.files?.length ?? 0}`);

        // 发射上传结果事件，让 monitor.ts 能够直接获取完整的下载链接
        uploadResultEmitter.emit(UPLOAD_RESULT_EVENT, {
          toolCallId,
          result: successResult,
        });

        // Build content with resource links and download URLs
        const content: Array<{ type: string; uri?: string; name?: string; mimeType?: string; text?: string; downloadUrl?: string }> = [];
        
        // Add resource links for each file
        for (const file of (successResult.files || [])) {
          content.push({
            type: "resource_link",
            uri: file.downloadUrl || file.uri,
            name: file.name,
            mimeType: file.mimeType,
            downloadUrl: file.downloadUrl,
          });
        }

        // Add a text summary with download URLs for AI to include in response
        const urlSummary = (successResult.files || [])
          .map((f: UploadedFileInfo) => {
            const url = f.downloadUrl || f.uri;
            return `- **${f.name}**: \`${url}\``;
          })
          .join("\n");
        
        content.push({
          type: "text",
          text: `Files uploaded successfully:\n${urlSummary}\n\n⚠️ IMPORTANT: The URLs above contain authentication signatures. You MUST copy the ENTIRE URL exactly as shown (including all query parameters after the "?"). Do NOT truncate or modify the URLs in any way. The links are valid for 24 hours.`,
        });

        return {
          output: successResult,
          result: successResult,
          details: successResult,
          content,
          isError: false,
        };
      },
    }; // end of tool object
    }); // end of factory function passed to registerTool

    // Register the channel plugin (channel.ts + onboarding.ts are lightweight config-only modules)
    api.registerChannel({ plugin: adpOpenclawPlugin });
    
    if (_registerCallCount === 1) {
      api.logger.info?.("[adp-openclaw] Plugin registration complete");
    }
  },
};

export default plugin;
