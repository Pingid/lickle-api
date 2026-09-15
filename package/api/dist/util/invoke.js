import * as is from './guard.js';
/**
 * Everything one invocation produces, as a single value: a stream is drained
 * into a list of its items, anything else is awaited.
 *
 * An operation that declares `out.returns: 'async-iter'` declares the schema of
 * one *item* — help calls it "Output (streamed)" and describes the item, and
 * `Operation.InferOut` wraps it in an `AsyncIterable`. So what this resolves to
 * is an array of `out`, and a target that publishes a schema for the collected
 * result publishes an array of that schema.
 *
 * A synchronous iterable is not a stream here: nothing produces one, and
 * treating a string as a stream of characters would be a trap.
 */
export const collect = (async (result) => {
    if (!is.stream(result))
        return await result;
    const items = [];
    for await (const item of result)
        items.push(item);
    return items;
});
//# sourceMappingURL=invoke.js.map