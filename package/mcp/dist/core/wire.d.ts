/**
 * The slice of the MCP wire protocol this package implements.
 *
 * Transcribed from the specification schema, pinned so the revision is explicit
 * and re-checkable:
 *
 *   modelcontextprotocol/modelcontextprotocol
 *   schema/2026-07-28/schema.ts
 *
 * The schema's own `schema.json` carries no root schema — only `$defs` — so
 * generating from it needs a synthetic root and yields hundreds of lines with
 * duplicate-suffixed artifacts. Hand-writing the dozen types actually used is
 * smaller and legible; the cost is that a revision bump means re-reading the
 * schema, which it would anyway.
 */
export declare const PROTOCOL_VERSION = "2026-07-28";
export declare const JSONRPC_VERSION = "2.0";
/** Error codes from the schema. `-32020`–`-32099` is the range reserved for MCP. */
export declare const PARSE_ERROR = -32700;
export declare const INVALID_REQUEST = -32600;
export declare const METHOD_NOT_FOUND = -32601;
export declare const INVALID_PARAMS = -32602;
export declare const INTERNAL_ERROR = -32603;
export declare const UNSUPPORTED_PROTOCOL_VERSION = -32022;
/**
 * The `_meta` keys this revision carries.
 *
 * There is no handshake any more: every request states its protocol version and
 * who is asking, and every result says who answered. Keeping the spellings in
 * one place is what makes a revision bump a single edit.
 */
export declare const META: {
    readonly protocolVersion: 'io.modelcontextprotocol/protocolVersion';
    readonly clientInfo: 'io.modelcontextprotocol/clientInfo';
    readonly clientCapabilities: 'io.modelcontextprotocol/clientCapabilities';
    readonly serverInfo: 'io.modelcontextprotocol/serverInfo';
};
export type RequestId = string | number;
export interface Implementation {
    name: string;
    version: string;
    title?: string;
}
export interface RequestMeta {
    [key: string]: unknown;
}
export interface JSONRPCRequest {
    jsonrpc: typeof JSONRPC_VERSION;
    /** Absent on a notification, which takes no response. */
    id?: RequestId;
    method: string;
    params?: {
        _meta?: RequestMeta;
        [key: string]: unknown;
    };
}
export interface JSONRPCNotification {
    jsonrpc: typeof JSONRPC_VERSION;
    method: string;
    params?: Record<string, unknown>;
}
export interface JSONRPCResultResponse {
    jsonrpc: typeof JSONRPC_VERSION;
    id: RequestId;
    result: Record<string, unknown>;
}
export interface JSONRPCErrorResponse {
    jsonrpc: typeof JSONRPC_VERSION;
    id: RequestId | null;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export type JSONRPCResponse = JSONRPCResultResponse | JSONRPCErrorResponse;
/**
 * Every result says which kind it is.
 *
 * `complete` is an answer. `input_required` is a server asking for something
 * before it can answer, which the client supplies on a retry — nothing here
 * produces one, but the field is typed for it so adding it later is additive.
 */
export type ResultType = 'complete' | 'input_required';
export interface Result {
    resultType: ResultType;
    _meta?: Record<string, unknown>;
}
/** Whether a shared intermediary may hold onto a list, not just the client. */
export type CacheScope = 'public' | 'private';
/** A list result says how long it may be trusted, so a client need not poll. */
export interface CacheableResult extends Result {
    ttlMs: number;
    cacheScope: CacheScope;
}
export interface ServerCapabilities {
    experimental?: Record<string, Record<string, unknown>>;
    completions?: Record<string, unknown>;
    prompts?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    tools?: {
        listChanged?: boolean;
    };
    extensions?: Record<string, Record<string, unknown>>;
}
export interface DiscoverResult extends Result {
    /** Revisions this server speaks; the client picks one for later requests. */
    supportedVersions: string[];
    capabilities: ServerCapabilities;
    serverInfo?: Implementation;
    /** Natural-language guidance about the server as a whole. */
    instructions?: string;
}
export interface ToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}
export interface Tool {
    name: string;
    title?: string;
    description?: string;
    /** Arguments are always a JSON object, so `type: "object"` is required. */
    inputSchema: {
        $schema?: string;
        type: 'object';
        [key: string]: unknown;
    };
    /** Any JSON Schema, including an array one — a result is not always a record. */
    outputSchema?: {
        $schema?: string;
        [key: string]: unknown;
    };
    annotations?: ToolAnnotations;
}
export interface ListToolsResult extends CacheableResult {
    tools: Tool[];
    nextCursor?: string;
}
export interface ListToolsRequestParams {
    cursor?: string;
}
export interface CallToolRequestParams {
    name: string;
    arguments?: Record<string, unknown>;
}
export interface TextContent {
    type: 'text';
    text: string;
}
/** Only `text` is produced here; the protocol also allows image/audio/resource. */
export type ContentBlock = TextContent;
export interface CallToolResult extends Result {
    content: ContentBlock[];
    /** Any JSON value conforming to the tool's `outputSchema`, when one is declared. */
    structuredContent?: unknown;
    /**
     * Errors *from* the tool belong here, not in a protocol error response —
     * otherwise the model cannot see the failure and self-correct. Errors in
     * *finding* the tool are protocol errors.
     */
    isError?: boolean;
}
//# sourceMappingURL=wire.d.ts.map