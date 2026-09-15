import type { Dispatch } from './server.ts';
/**
 * Serve MCP over Streamable HTTP: each message is a POST to a single endpoint,
 * answered with a JSON object.
 *
 * Built on web-standard `Request`/`Response` so it runs on Node, Deno, Bun and
 * workers without a framework. It answers once and closes, so it passes no
 * `emit` and a long call simply stays quiet until it is done.
 *
 * It implements none of the transport's security requirements — no `Origin`
 * validation, no protection against DNS rebinding, no checking of headers
 * mirrored from the body. Putting this on a public port is the caller's
 * business, and needs a layer in front of it.
 */
export declare const httpHandler: (dispatch: Dispatch) => (request: Request) => Promise<Response>;
//# sourceMappingURL=http.d.ts.map