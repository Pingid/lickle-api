export type Meta = {
    meta?: Record<string, unknown>;
    description?: string;
    default?: any;
};
export declare const update: <T extends object>(t: T, m: Partial<Meta>) => WeakMap<T, Meta>;
export declare const get: <T extends object>(t: T) => Meta;
/**
 * A target's own configuration for a node.
 *
 * `.meta(key, …)` records the arguments it was called with, so what is stored is
 * an array and a target reads the first of it. That convention is this module's
 * choice, so answering for it is this module's job rather than a line every
 * target copies.
 */
export declare const of: <T>(t: object, key: string) => T | undefined;
//# sourceMappingURL=register.d.ts.map