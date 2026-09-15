let _meta = undefined;
const reg = () => {
    if (_meta)
        return _meta;
    _meta = new WeakMap();
    return _meta;
};
export const update = (t, m) => {
    const _meta = reg();
    const current = _meta.get(t) ?? {};
    return _meta.set(t, { ...current, ...m, meta: { ...(current.meta ?? {}), ...m.meta } });
};
export const get = (t) => {
    const _meta = reg();
    return _meta.get(t) ?? {};
};
/**
 * A target's own configuration for a node.
 *
 * `.meta(key, …)` records the arguments it was called with, so what is stored is
 * an array and a target reads the first of it. That convention is this module's
 * choice, so answering for it is this module's job rather than a line every
 * target copies.
 */
export const of = (t, key) => {
    const args = get(t).meta?.[key];
    return Array.isArray(args) ? args[0] : args;
};
//# sourceMappingURL=register.js.map