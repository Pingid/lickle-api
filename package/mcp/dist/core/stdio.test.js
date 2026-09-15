import { expect, test } from 'vitest';
import { serveStdio } from './stdio.js';
import { JSONRPC_VERSION, PARSE_ERROR } from './wire.js';
/** Answers every request with its own id, and nothing to a notification. */
const echo = async (message) => {
    const { id, method } = message;
    if (id === undefined)
        return undefined;
    return { jsonrpc: JSONRPC_VERSION, id, result: { method } };
};
/** Feeds exact chunk boundaries, so a split message is a real test and not a hope. */
const drive = async (chunks, dispatch = echo) => {
    const out = [];
    await serveStdio(dispatch, {
        input: (async function* () {
            for (const chunk of chunks)
                yield chunk;
        })(),
        write: (chunk) => void out.push(chunk),
    });
    for (const frame of out)
        expect(frame.endsWith('\n')).toBe(true);
    return out.map((frame) => JSON.parse(frame));
};
const request = (id, method = 'tools/list') => JSON.stringify({ jsonrpc: JSONRPC_VERSION, id, method });
test('one message per line', async () => {
    expect(await drive([`${request(1)}\n`])).toEqual([
        { jsonrpc: JSONRPC_VERSION, id: 1, result: { method: 'tools/list' } },
    ]);
});
test('a message split across chunks is reassembled', async () => {
    const line = `${request(1)}\n`;
    const parts = [line.slice(0, 10), line.slice(10, 25), line.slice(25)];
    expect(await drive(parts)).toHaveLength(1);
});
test('several messages in one chunk are answered in order', async () => {
    const got = await drive([`${request(1)}\n${request(2)}\n${request(3)}\n`]);
    expect(got.map((r) => r.id)).toEqual([1, 2, 3]);
});
test('a last message with no trailing newline still counts', async () => {
    expect(await drive([request(1)])).toHaveLength(1);
});
test('blank lines are skipped', async () => {
    expect(await drive([`\n\n${request(1)}\n\n`])).toHaveLength(1);
});
test('a broken message is answered without ending the session', async () => {
    const got = await drive([`{\n${request(2)}\n`]);
    expect(got[0]).toEqual({ jsonrpc: JSONRPC_VERSION, id: null, error: { code: PARSE_ERROR, message: 'invalid JSON' } });
    expect(got[1]).toMatchObject({ id: 2 });
});
test('a notification produces no frame', async () => {
    expect(await drive([`${JSON.stringify({ jsonrpc: JSONRPC_VERSION, method: 'notifications/x' })}\n`])).toEqual([]);
});
test('bytes are decoded', async () => {
    expect(await drive([new TextEncoder().encode(`${request(7)}\n`)])).toMatchObject([{ id: 7 }]);
});
test('nothing but protocol frames reaches the output', async () => {
    const out = await drive([`${request(1)}\n`]);
    expect(out).toHaveLength(1);
});
test('a notification a call emits is written before that call answers', async () => {
    const talking = async (message, emit) => {
        emit?.({ jsonrpc: JSONRPC_VERSION, method: 'notifications/progress', params: { progress: 1 } });
        return { jsonrpc: JSONRPC_VERSION, id: message.id, result: {} };
    };
    const got = await drive([`${request(1)}\n`], talking);
    expect(got.map((f) => f.method ?? f.id)).toEqual(['notifications/progress', 1]);
});
//# sourceMappingURL=stdio.test.js.map