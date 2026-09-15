import { isInputError } from '@lickle/api';
import { api, collect } from '@lickle/api/util';
import { bindArgs } from './args.js';
import { errorResult, toolResult } from './result.js';
import { tools } from './tools.js';
import { INTERNAL_ERROR, INVALID_PARAMS, INVALID_REQUEST, JSONRPC_VERSION, METHOD_NOT_FOUND, META, PROTOCOL_VERSION, UNSUPPORTED_PROTOCOL_VERSION, } from './wire.js';
/**
 * The tool list cannot change for the life of the process — it is read off the
 * tree once — so an hour is a claim about redeployment rather than about drift.
 * `private` because a list may legitimately differ with the authorization
 * presented, and a shared cache must not hand one caller's list to another.
 */
const TTL_MS = 3_600_000;
const SCOPE = 'private';
/**
 * Serve a program over MCP, as a plain function: message in, message out.
 *
 * This is the whole protocol surface, so every behaviour below is testable
 * without a transport or a subprocess — `stdio.ts` and `http.ts` only move
 * bytes. Scope is the tools half: `server/discover`, `tools/list` and
 * `tools/call`. Capabilities advertise nothing else, so answering everything
 * else with `METHOD_NOT_FOUND` is a complete answer rather than a gap.
 */
export const server = (program, ...args) => {
    const [opts] = args;
    const root = api.of(program);
    const entries = tools(program, opts ?? {});
    const byName = new Map(entries.map((entry) => [entry.tool.name, entry]));
    const info = {
        name: opts?.name ?? root.name,
        version: opts?.version ?? '0.0.0',
        ...(opts?.title === undefined ? {} : { title: opts.title }),
    };
    const instructions = opts?.instructions ?? (root.description === '' ? undefined : root.description);
    return async (message, emit) => {
        if (!isRequest(message))
            return error(null, INVALID_REQUEST, 'not a JSON-RPC request');
        const { id, method, params } = message;
        // No `id` means a notification: act on nothing, answer nothing.
        if (id === undefined)
            return undefined;
        const session = sessionOf(message);
        if (session.protocolVersion !== undefined && session.protocolVersion !== PROTOCOL_VERSION)
            return error(id, UNSUPPORTED_PROTOCOL_VERSION, `unsupported protocol version '${session.protocolVersion}'`, {
                supportedVersions: [PROTOCOL_VERSION],
            });
        switch (method) {
            case 'server/discover':
                return result(id, info, {
                    resultType: 'complete',
                    supportedVersions: [PROTOCOL_VERSION],
                    capabilities: { tools: {} },
                    serverInfo: info,
                    ...(instructions === undefined ? {} : { instructions }),
                });
            case 'tools/list':
                return listTools(id, info, params, entries, opts);
            case 'tools/call':
                return callTool(id, info, params, byName, session, emit, opts?.context);
            default:
                return error(id, METHOD_NOT_FOUND, `unknown method '${method}'`);
        }
    };
};
/**
 * The tool list, one page at a time when a page size is set.
 *
 * The cursor is the name of the next page's first tool rather than an index:
 * it survives a restart, it cannot silently mean something else after the tree
 * changes, and one we could not have issued is detectably wrong.
 */
const listTools = (id, info, params, entries, opts) => {
    const size = opts?.pageSize;
    const cursor = params?.cursor;
    if (cursor !== undefined && size === undefined)
        return error(id, INVALID_PARAMS, `this server does not page its tools, so '${cursor}' is not a cursor it issued`);
    let from = 0;
    if (cursor !== undefined) {
        from = entries.findIndex((entry) => entry.tool.name === cursor);
        if (from === -1)
            return error(id, INVALID_PARAMS, `unknown cursor '${cursor}'`);
    }
    const page = size === undefined ? entries.slice(from) : entries.slice(from, from + size);
    const next = size === undefined ? undefined : entries[from + size]?.tool.name;
    return result(id, info, {
        resultType: 'complete',
        tools: page.map((entry) => entry.tool),
        ttlMs: opts?.cache?.ttlMs ?? TTL_MS,
        cacheScope: opts?.cache?.scope ?? SCOPE,
        ...(next === undefined ? {} : { nextCursor: next }),
    });
};
const callTool = async (id, info, params, byName, session, emit, context) => {
    const name = params?.name;
    if (typeof name !== 'string')
        return error(id, INVALID_PARAMS, "'name' is required");
    // Failing to *find* the tool is a protocol error; everything that goes wrong
    // once it is found is a tool result the model can read and correct.
    const entry = byName.get(name);
    if (entry === undefined)
        return error(id, METHOD_NOT_FOUND, `unknown tool '${name}'`);
    let inputs;
    try {
        inputs = await bindArgs(entry.inputs, params?.arguments);
    }
    catch (e) {
        if (isInputError(e))
            return result(id, info, errorResult(e));
        return error(id, INTERNAL_ERROR, e instanceof Error ? e.message : String(e));
    }
    try {
        const produced = entry.op.handle(inputs, context);
        // There is no streaming tool result in this revision, so a streaming
        // operation is drained and answered all at once — against the array schema
        // its tool already declared. Progress is how it says it is still going.
        const value = entry.stream ? await drain(produced, session, emit) : await collect(produced);
        return result(id, info, toolResult(value, entry.structured));
    }
    catch (e) {
        return result(id, info, errorResult(e));
    }
};
/** Drain a stream, telling the client how it is going when it asked to be told. */
const drain = async (produced, session, emit) => {
    const token = session.progressToken;
    if (emit === undefined || token === undefined)
        return collect(produced);
    const items = [];
    for await (const item of produced) {
        items.push(item);
        emit({
            jsonrpc: JSONRPC_VERSION,
            method: 'notifications/progress',
            params: { progressToken: token, progress: items.length },
        });
    }
    return items;
};
const sessionOf = (message) => {
    const meta = message.params?._meta ?? {};
    const version = meta[META.protocolVersion];
    const token = meta['progressToken'];
    return {
        ...(typeof version === 'string' ? { protocolVersion: version } : {}),
        ...(typeof token === 'string' || typeof token === 'number' ? { progressToken: token } : {}),
        clientInfo: meta[META.clientInfo],
        clientCapabilities: meta[META.clientCapabilities],
    };
};
const isRequest = (m) => typeof m === 'object' &&
    m !== null &&
    m.jsonrpc === JSONRPC_VERSION &&
    typeof m.method === 'string';
/** Every result says who answered it, which is how a stateless protocol identifies a server. */
const result = (id, info, value) => ({
    jsonrpc: JSONRPC_VERSION,
    id,
    result: { ...value, _meta: { [META.serverInfo]: info } },
});
const error = (id, code, message, data) => ({
    jsonrpc: JSONRPC_VERSION,
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
});
//# sourceMappingURL=server.js.map