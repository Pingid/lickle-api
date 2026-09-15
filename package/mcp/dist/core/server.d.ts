import { type Api, type Namespace } from '@lickle/api';
import { type ToolsOpts } from './tools.ts';
import { type CacheScope, type Implementation, type JSONRPCNotification, type JSONRPCResponse } from './wire.ts';
/** A request-scoped notification, on the stream of the request it belongs to. */
export type Emit = (notification: JSONRPCNotification) => void;
/**
 * Handle one decoded JSON-RPC message. Resolves to `undefined` for a
 * notification, which takes no response.
 *
 * `emit` is how a transport that can interleave — stdio, a streamed HTTP
 * response — lets a long call say something before it finishes. A transport that
 * answers once and closes passes nothing, and the call simply stays quiet, which
 * is conformant: progress is only ever sent when it was asked for.
 */
export type Dispatch = (message: unknown, emit?: Emit) => Promise<JSONRPCResponse | undefined>;
/** Who is asking, as this revision states it on every request rather than once. */
export interface Session {
    protocolVersion?: string;
    clientInfo?: Implementation;
    clientCapabilities?: Record<string, unknown>;
    /** A token the client supplied to be told how a long call is going. */
    progressToken?: string | number;
}
export interface McpOpts extends ToolsOpts {
    /** Identifies this server on every result. Defaults to the root node's own name. */
    name?: string;
    version?: string;
    title?: string;
    /** Guidance about the server as a whole. Defaults to the root's description. */
    instructions?: string;
    /** What `tools/list` claims about caching itself. */
    cache?: {
        ttlMs?: number;
        scope?: CacheScope;
    };
    /** Tools per `tools/list` page. Omitted means one page and no cursor. */
    pageSize?: number;
}
type ServerArgs<T extends Api.Program> = Namespace.Cx<T> extends void ? [(McpOpts & {
    context?: Namespace.Cx<T>;
})?] : [McpOpts & {
    context: Namespace.Cx<T>;
}];
/**
 * Serve a program over MCP, as a plain function: message in, message out.
 *
 * This is the whole protocol surface, so every behaviour below is testable
 * without a transport or a subprocess — `stdio.ts` and `http.ts` only move
 * bytes. Scope is the tools half: `server/discover`, `tools/list` and
 * `tools/call`. Capabilities advertise nothing else, so answering everything
 * else with `METHOD_NOT_FOUND` is a complete answer rather than a gap.
 */
export declare const server: <T extends Api.Program>(program: T, ...args: ServerArgs<T>) => Dispatch;
export {};
//# sourceMappingURL=server.d.ts.map