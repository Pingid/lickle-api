export type Meta = {
    meta?: Record<string, unknown>;
    description?: string;
    default?: any;
};
export declare const update: <T extends object>(t: T, m: Partial<Meta>) => WeakMap<T, Meta>;
export declare const get: <T extends object>(t: T) => Meta;
//# sourceMappingURL=register.d.ts.map