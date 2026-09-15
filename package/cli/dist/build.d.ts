import { type Api, type Namespace, type Operation, type Schema, type Tp, type Type } from '@lickle/api';
import type { FieldMeta } from './meta.ts';
/**
 * A command, written the way a command line wants to be written: flags with
 * short names, some of them placeable by position, and a handler that prints
 * rather than returns.
 *
 * `cmd` compiles it to an operation and hangs it off the command under the api
 * key, so the same declaration is a command here and a tool everywhere else.
 * Nothing about it is a second source of truth — the operation is derived, never
 * written twice.
 */
export interface Cmd<N extends string = string, A extends Cmd.Args = Cmd.Args, P extends Cmd.Positional<A> = Cmd.Positional<A>> {
    name: N;
    description: string;
    args: A;
    positional?: P;
    handle: (args: Cmd.InferArgs<A>) => Promise<void>;
}
export declare namespace Cmd {
    interface CmdOp<N extends string = string, A extends Args = Args, P extends Positional<A> = Positional<A>> extends Cmd<N, A, P>, Api<Operation<N, Type.Object<{
        [K in keyof A]: A[K]['type'];
    }>, Type.Void>> {
    }
    type Args = Record<string, Arg>;
    type PrimType = Type.Number | Type.String | Type.Boolean | Type.Enum<string>;
    type Type = PrimType | Type.Array<PrimType> | Type.Union<PrimType | Type.Undefined>;
    type InferArgs<A extends Args> = {
        [K in keyof A]: Schema.InferOutput<A[K]['type']>;
    };
    type Opts = FieldMeta;
    type Arg = FieldMeta & {
        description?: string;
        type: Type;
    };
    /**
     * Which args may be written by position, in order.
     *
     * Only the last may be a list, since it takes everything left over — so every
     * earlier entry has to name an arg of a single value.
     */
    type Positional<A extends Args> = [...One<A>[], One<A> | Many<A>];
    type One<A extends Args> = {
        [K in keyof A]: A[K]['type'] extends Type.Array<any> ? never : K;
    }[keyof A];
    type Many<A extends Args> = {
        [K in keyof A]: A[K]['type'] extends Type.Array<any> ? K : never;
    }[keyof A];
}
/**
 * Put anything into a command tree.
 *
 * A `Cmd` is compiled to the operation it describes. An operation or a namespace
 * built with `@lickle/api` is already one and passes straight through, so a
 * tree can mix commands written for this target with operations written for no
 * target in particular.
 */
export declare const cmd: {
    <const N extends string, const A extends Cmd.Args, const P extends Cmd.Positional<A>>(p: Cmd<N, A, P>): Cmd.CmdOp<N, A, P>;
    <N extends string, I extends Operation.Input = Operation.Input, O extends Operation.Output = Operation.Output>(p: Operation<N, I, O> & Api<Operation<N, I, O>>): Operation<N, I, O> & Api<Operation<N, I, O>>;
    <const O extends Api<Namespace>>(p: O): O;
};
export declare const flag: (description?: string) => Tp<Type.Boolean>;
export declare const string: (description?: string) => Tp<Type.String>;
export declare const num: (description?: string) => Tp<Type.Number>;
/** A closed set: the handler sees the members, not just `string`. */
export declare const choice: <const T extends string[]>(members: T, description?: string) => Tp<Type.Enum<T[number]>>;
/**
 * Repeated on the command line: `-t home -t errands`. Absent means empty.
 *
 * The item-less form is a separate, non-generic signature on purpose: an arg's
 * declared type is `Cmd.Type`, and a generic return would be inferred from that
 * context — making `list()` a list of anything a command line can express
 * rather than a list of strings.
 */
export declare const list: {
    (description?: string): Tp<Type.Array<Type.String>>;
    <T extends Schema>(of: T, description?: string): Tp<Type.Array<T>>;
};
/** May be left out entirely, which is not the same as having a default. */
export declare const optional: <T extends Schema>(of: T, description?: string) => Tp<Type.Union<T | Tp<Type.Undefined>>>;
//# sourceMappingURL=build.d.ts.map