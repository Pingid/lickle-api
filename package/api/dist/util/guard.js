export const operation = (n) => 'handle' in n;
export const namespace = (n) => !operation(n);
/**
 * Observed rather than declared: a handler may hand back an iterable whatever
 * its `out` says, and once a value exists the value is the better authority.
 */
export const stream = (v) => typeof v === 'object' && v !== null && Symbol.asyncIterator in v;
//# sourceMappingURL=guard.js.map