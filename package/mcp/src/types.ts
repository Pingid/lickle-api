/**
 * The slice of the MCP wire protocol this package implements.
 *
 * Transcribed from the specification schema, pinned so the revision is
 * explicit and re-checkable:
 *
 *   modelcontextprotocol/modelcontextprotocol
 *   commit aa8ce049f089f92618340190d4ece141f663310d
 *   schema/2026-07-28/schema.ts
 *
 * The schema's own `schema.json` carries no root schema — only 155 `$defs` —
 * so generating from it needs a synthetic root and yields ~600 lines with
 * duplicate-suffixed artifacts (`Annotations1`…`Annotations4`). Hand-writing
 * the dozen types actually used is smaller and legible; the cost is that a
 * revision bump means re-reading the schema, which it would anyway.
 */

export const PROTOCOL_VERSION = '2026-07-28'
export const JSONRPC_VERSION = '2.0'

/** Error codes from the schema. */
export const PARSE_ERROR = -32700
export const INVALID_REQUEST = -32600
export const METHOD_NOT_FOUND = -32601
export const INVALID_PARAMS = -32602
export const INTERNAL_ERROR = -32603
export const UNSUPPORTED_PROTOCOL_VERSION = -32022

export type RequestId = string | number

/**
 * Every request carries its protocol version and client capabilities in
 * `_meta.io.modelcontextprotocol/*` fields — the body is the source of truth,
 * even on transports that mirror them into envelope metadata.
 */
export interface RequestMeta {
  'io.modelcontextprotocol/protocol-version'?: string
  [key: string]: unknown
}

export interface JSONRPCRequest {
  jsonrpc: typeof JSONRPC_VERSION
  /** Absent on a notification, which takes no response. */
  id?: RequestId
  method: string
  params?: { _meta?: RequestMeta; [key: string]: unknown }
}

export interface JSONRPCResultResponse {
  jsonrpc: typeof JSONRPC_VERSION
  id: RequestId
  result: Record<string, unknown>
}

export interface JSONRPCErrorResponse {
  jsonrpc: typeof JSONRPC_VERSION
  id: RequestId | null
  error: { code: number; message: string; data?: unknown }
}

export type JSONRPCResponse = JSONRPCResultResponse | JSONRPCErrorResponse

// ---------------- server/discover --------------------------

export interface ServerCapabilities {
  experimental?: Record<string, Record<string, unknown>>
  completions?: Record<string, unknown>
  prompts?: { listChanged?: boolean }
  resources?: { subscribe?: boolean; listChanged?: boolean }
  tools?: { listChanged?: boolean }
}

export interface DiscoverResult {
  /** Revisions this server speaks; the client picks one for later requests. */
  supportedVersions: string[]
  capabilities: ServerCapabilities
  /** Natural-language guidance about the server as a whole. */
  instructions?: string
}

// ---------------- tools --------------------------

export interface ToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface Tool {
  name: string
  title?: string
  description?: string
  /** Arguments are always a JSON object, so `type: "object"` is required. */
  inputSchema: { $schema?: string; type: 'object'; [key: string]: unknown }
  outputSchema?: { $schema?: string; [key: string]: unknown }
  annotations?: ToolAnnotations
}

export interface ListToolsResult {
  tools: Tool[]
  nextCursor?: string
}

export interface CallToolRequestParams {
  name: string
  arguments?: Record<string, unknown>
}

export interface TextContent {
  type: 'text'
  text: string
}

/** Only `text` is produced here; the protocol also allows image/audio/resource. */
export type ContentBlock = TextContent

export interface CallToolResult {
  content: ContentBlock[]
  /** Conforms to the tool's `outputSchema` when one is declared. */
  structuredContent?: unknown
  /**
   * Errors *from* the tool belong here, not in a protocol error response —
   * otherwise the model cannot see the failure and self-correct. Errors in
   * *finding* the tool are protocol errors.
   */
  isError?: boolean
}
