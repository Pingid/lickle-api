import { apiOf } from '../types.js';
import * as is from './guard.js';
import { getDefault } from './schema.js';
/**
 * Match one path segment against a namespace's children.
 *
 * There is no `children()` helper: since every namespace is named, a
 * namespace's children are exactly its `cmds`.
 */
export const findChild = (ns, segment) => apiOf(apiOf(ns).operations.find((c) => apiOf(c).name === segment));
/** Every node in the tree, depth first, each with the path that reaches it. */
export const walk = (ns, skip, path = []) => ns.operations
    .map((x) => apiOf(x))
    .flatMap((node) => {
    if (skip?.(node) === true)
        return [];
    const here = [...path, node.name];
    const located = { path: here, node: node };
    return is.namespace(node) ? [located, ...walk(node, skip, here)] : [located];
});
/**
 * Every callable operation<> in the tree, with its path. Namespaces contribute path
 * segments but are not themselves callable, so only leaves appear.
 *
 * This is the shape every target consumes: a target is a function from these to
 * whatever it emits.
 */
export const operations = (ns, skip) => walk(ns, skip).filter((l) => !is.namespace(l.node));
/** Collect the inputs for an operation. */
export const collectInputs = (op, get) => {
    let result = {};
    let missing = [];
    const keys = Object.keys(op.in);
    for (const key of keys) {
        const v = get(key) ?? getDefault(op.in, key);
        if (!v)
            missing.push(key);
        else
            result[key] = v.value;
    }
    if (missing.length > 0)
        return { ok: false, missing };
    return { ok: true, value: result };
};
//# sourceMappingURL=visit.js.map