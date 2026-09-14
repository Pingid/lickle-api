const API = `@lickle/api:1.0.0`;
export const apiOf = (t) => {
    if (t === undefined)
        return undefined;
    if (t[API])
        return t[API];
    return t;
};
export const apiAs = (t) => {
    if (t === undefined)
        return undefined;
    if (t[API])
        return t;
    return { [API]: t };
};
//# sourceMappingURL=types.js.map