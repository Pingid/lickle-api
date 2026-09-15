import type { Dispatch } from './server.ts';
/**
 * The byte streams the stdio transport rides on, narrowed to what is used so
 * tests can pass plain objects instead of real process streams.
 */
export interface StdioIO {
    input: AsyncIterable<string | Uint8Array>;
    write: (chunk: string) => void;
}
/**
 * Serve MCP over newline-delimited JSON-RPC, the stdio framing from the spec.
 *
 * Resolves when the input ends, so a caller can simply await it — which is what
 * keeps an `mcp` subcommand alive for as long as its client is attached.
 *
 * Nothing but protocol frames may reach the output stream: anything else
 * corrupts the session. Diagnostics belong on stderr.
 */
export declare const serveStdio: (dispatch: Dispatch, io?: Partial<StdioIO>) => Promise<void>;
//# sourceMappingURL=stdio.d.ts.map