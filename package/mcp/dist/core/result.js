/**
 * What an operation returned, as a tool result.
 *
 * `structuredContent` takes any JSON value in this revision, and an operation
 * returns one value described by one schema — so there is no question to ask
 * about the *shape* of what came back. Either the operation declares an output,
 * in which case it is published structurally and rendered as text beside it, or
 * it declares none and there is nothing to publish.
 *
 * The text copy is not redundant: a client that ignores structured content still
 * has to show the model something, and a tool whose result it cannot read is a
 * tool the model cannot use.
 */
export const toolResult = (value, structured) => {
    if (value === undefined || value === null)
        return { resultType: 'complete', content: [{ type: 'text', text: 'Done.' }] };
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return {
        resultType: 'complete',
        content: [{ type: 'text', text }],
        ...(structured ? { structuredContent: value } : {}),
    };
};
/**
 * What a tool threw, as a tool result.
 *
 * A failure the model can act on has to reach the model, which means it is a
 * result and not a protocol error — the two are different channels on purpose,
 * and a client is only obliged to show the model this one.
 */
export const errorResult = (err) => ({
    resultType: 'complete',
    content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
    isError: true,
});
//# sourceMappingURL=result.js.map