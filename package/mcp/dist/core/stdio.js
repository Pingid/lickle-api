import { JSONRPC_VERSION, PARSE_ERROR } from './wire.js';
/**
 * Serve MCP over newline-delimited JSON-RPC, the stdio framing from the spec.
 *
 * Resolves when the input ends, so a caller can simply await it — which is what
 * keeps an `mcp` subcommand alive for as long as its client is attached.
 *
 * Nothing but protocol frames may reach the output stream: anything else
 * corrupts the session. Diagnostics belong on stderr.
 */
export const serveStdio = async (dispatch, io = {}) => {
    const input = io.input ?? process.stdin;
    const write = io.write ?? ((chunk) => void process.stdout.write(chunk));
    const send = (message) => write(`${JSON.stringify(message)}\n`);
    // A chunk is not a message: one can split a message, or carry several.
    let buffer = '';
    for await (const chunk of input) {
        buffer += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            await handle(line, dispatch, send);
            newline = buffer.indexOf('\n');
        }
    }
    // A final message with no trailing newline still counts.
    await handle(buffer, dispatch, send);
};
const handle = async (line, dispatch, send) => {
    if (line.trim() === '')
        return;
    let message;
    try {
        message = JSON.parse(line);
    }
    catch {
        send({ jsonrpc: JSONRPC_VERSION, id: null, error: { code: PARSE_ERROR, message: 'invalid JSON' } });
        return;
    }
    // This transport interleaves, so a long call can say how it is going on the
    // same stream before its result lands.
    const emit = (notification) => send(notification);
    const response = await dispatch(message, emit);
    if (response !== undefined)
        send(response);
};
//# sourceMappingURL=stdio.js.map