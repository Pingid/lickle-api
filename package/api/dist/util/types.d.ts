export type OpK<T, K extends keyof T> = Computed<Omit<T, K> & Partial<Pick<T, K>>>;
export type Params<T> = T extends (...args: infer A) => any ? A : never;
export type Computed<T> = {
    [K in keyof T]: T[K];
} & {};
export type Intersect<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
//# sourceMappingURL=types.d.ts.map