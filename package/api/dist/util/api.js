import { API } from '../types.js';
export const of = (t) => {
    if (t === undefined)
        return undefined;
    if (t[API])
        return t[API];
    return t;
};
export const as = (t) => {
    if (t === undefined)
        return undefined;
    if (t[API])
        return t;
    return on(t, t);
};
/**
 * Point a carrier at the api node it stands for.
 *
 * `apiAs` brands a node with itself, which is all an operation or a namespace
 * needs. A target that has its own shape uses this instead: a `Cmd` is written
 * the way a command line wants to be written and carries the operation it
 * compiles to, so every other target still sees an operation.
 *
 * The key is non-enumerable, so branding never shows up in a spread or a
 * `JSON.stringify` — and never in the JSON Schema a type emits.
 */
export const on = (carrier, api) => {
    Object.defineProperty(carrier, API, { value: api, enumerable: false, configurable: true });
    return carrier;
};
//# sourceMappingURL=api.js.map