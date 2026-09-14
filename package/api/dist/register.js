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
//# sourceMappingURL=register.js.map