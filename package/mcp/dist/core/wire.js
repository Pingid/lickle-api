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
export const PROTOCOL_VERSION = '2026-07-28';
export const JSONRPC_VERSION = '2.0';
/** Error codes from the schema. `-32020`–`-32099` is the range reserved for MCP. */
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;
/**
 * The `_meta` keys this revision carries.
 *
 * There is no handshake any more: every request states its protocol version and
 * who is asking, and every result says who answered. Keeping the spellings in
 * one place is what makes a revision bump a single edit.
 */
export const META = {
    protocolVersion: 'io.modelcontextprotocol/protocolVersion',
    clientInfo: 'io.modelcontextprotocol/clientInfo',
    clientCapabilities: 'io.modelcontextprotocol/clientCapabilities',
    serverInfo: 'io.modelcontextprotocol/serverInfo',
};
//# sourceMappingURL=wire.js.map