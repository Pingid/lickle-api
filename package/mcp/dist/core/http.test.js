import { t } from '@lickle/api';
import { expect, test } from 'vitest';
import { httpHandler } from './http.js';
import { server } from './server.js';
import { JSONRPC_VERSION, PARSE_ERROR } from './wire.js';
const version = t.op({ name: 'version', description: 'Print it.', out: t.string(), handle: async () => '1.0.0' });
const handler = httpHandler(server(t.ns({ name: 'root', operations: [version] }), { onWarn: () => { } }));
const post = (body) => handler(new Request('https://example.test/mcp', { method: 'POST', body, headers: { 'content-type': 'application/json' } }));
const send = (method, params) => post(JSON.stringify({ jsonrpc: JSONRPC_VERSION, id: 1, method, params }));
const notify = (method) => post(JSON.stringify({ jsonrpc: JSONRPC_VERSION, method }));
test('a posted message is answered as JSON', async () => {
    const res = await send('tools/list');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect((await res.json()).result.tools).toHaveLength(1);
});
test('a tool call round-trips', async () => {
    const res = await send('tools/call', { name: 'version' });
    expect((await res.json()).result.structuredContent).toBe('1.0.0');
});
test('a notification is accepted and answered with nothing', async () => {
    const res = await notify('notifications/x');
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
});
test('an unparseable body is a bad request carrying the protocol error', async () => {
    const res = await post('{');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(PARSE_ERROR);
});
test('only POST is allowed', async () => {
    const res = await handler(new Request('https://example.test/mcp'));
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
});
//# sourceMappingURL=http.test.js.map