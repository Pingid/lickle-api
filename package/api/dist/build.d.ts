import { type Input, type Namespace, type Operation, type Output, type Schema, type Type, type Fields, type Api, type AnyOperation, type AnyNamespace } from './types.ts';
import type { TypeMeta, NamespaceMeta, OperationMeta } from './meta.ts';
export declare const op: {
    <N extends string, I extends Input, O extends Output>(schema: Operation<N, I, O>): Op<Operation<N, I, O> & Api<Operation<N, I, O>>>;
    <N extends string, I extends Record<string, Schema> = Record<string, never>, O extends Output = Type.Void>(schema: OpK<Operation.Schema<N, I, O>, 'out' | 'in'> & Operation.Handler<Fields.Infer<I>, Output.Infer<O>>): Op<Operation<N, Type.Object<I>, O> & Api<Operation<N, Type.Object<I>, O>>>;
};
export type Op<T> = T & {
    describe: (description: string) => Op<T>;
    meta: <K extends keyof Omit<OperationMeta<T>, '_$'>>(k: K, ...args: Params<OperationMeta<T>[K]>) => Op<T>;
};
export declare const ns: <const N extends string, O extends (Api<any> | AnyOperation | AnyNamespace)[]>(schema: Namespace<N, O>) => Ns<Namespace<N, { [K in keyof O]: Api.Wrap<O[K]>; }> & Api<Namespace<N, { [K in keyof O]: Api.Wrap<O[K]>; }>>>;
export type Ns<T> = T & {
    describe: (description: string) => Ns<T>;
    meta: <K extends keyof Omit<NamespaceMeta<T>, '_$'>>(k: K, ...args: Params<NamespaceMeta<T>[K]>) => Ns<T>;
};
export declare const output: <O extends Schema = Type.Void, R extends Output.Returns | undefined = undefined>(o?: O, returns?: R) => R extends undefined ? O : O & {
    returns: R;
};
export type Tp<T> = T & {
    describe: (description: string) => Tp<T>;
    default: (defaultValue: T extends Schema<any, infer O> ? O : never) => Tp<T>;
    meta: <K extends keyof Omit<TypeMeta<T>, '_$'>>(k: K, ...args: Params<TypeMeta<T>[K]>) => Tp<T>;
};
export declare const empty: (d?: string) => Tp<Type.Void>;
export declare const number: (d?: string) => Tp<Type.Number>;
export declare const string: (d?: string) => Tp<Type.String>;
export declare const boolean: (d?: string) => Tp<Type.Boolean>;
export declare const unknown: (d?: string) => Tp<Type.Unknown>;
export declare const any: (d?: string) => Tp<Type.Any>;
export declare const nul: (d?: string) => never;
export declare const undef: (d?: string) => never;
export declare const array: <T extends Schema>(p: T, description?: string) => Tp<Type.Array<T>>;
export declare const set: <const T extends string[]>(p: T, description?: string) => Tp<Type.Enum<T[number]>>;
export declare const union: <const T extends Schema[]>(p: T, description?: string) => Tp<Type.Union<T[number]>>;
export declare const object: <const T extends Fields.Properties>(p: T, description?: string) => Tp<Type.Object<T>>;
export declare const optional: <T extends Schema>(t: T) => T & {
    optional: true;
};
type OpK<T, K extends keyof T> = Computed<Omit<T, K> & Partial<Pick<T, K>>>;
type Params<T> = T extends (...args: infer A) => any ? A : never;
type Computed<T> = {
    [K in keyof T]: T[K];
} & {};
export declare const t: {
    void: Tp<Type.Void>;
    empty: typeof empty;
    number: typeof number;
    string: typeof string;
    boolean: typeof boolean;
    unknown: typeof unknown;
    any: typeof any;
    null: typeof nul;
    undefined: typeof undef;
    array: typeof array;
    set: typeof set;
    union: typeof union;
    object: typeof object;
    optional: typeof optional;
    output: typeof output;
    op: {
        <N extends string, I extends Input, O extends Output>(schema: Operation<N, I, O>): Op<Operation<N, I, O> & Api<Operation<N, I, O>>>;
        <N extends string, I extends Record<string, Schema> = Record<string, never>, O extends Output = Type.Void>(schema: OpK<Operation.Schema<N, I, O>, 'out' | 'in'> & Operation.Handler<Fields.Infer<I>, Output.Infer<O>>): Op<Operation<N, Type.Object<I>, O> & Api<Operation<N, Type.Object<I>, O>>>;
    };
    ns: typeof ns;
};
export {};
//# sourceMappingURL=build.d.ts.map