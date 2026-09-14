import type { Type, Input, Api, Output, Operation, Namespace, Schema } from '@lickle/api';
import type { FieldMeta } from './meta.ts';
export interface Cmd<N extends string = string, A extends Cmd.Args = Cmd.Args, P extends (keyof A)[] = []> {
    name: N;
    description: string;
    args: A;
    positional?: P;
    handle: (args: Cmd.InferArgs<A>) => Promise<void>;
}
export declare namespace Cmd {
    interface CmdOp<N extends string = string, A extends Args = Args, P extends (keyof A)[] = []> extends Cmd<N, A, P>, Api<Operation<N, Type.Object<{
        [K in keyof A]: A[K]['type'];
    }>, Type.Void>> {
    }
    type Args = Record<string, Arg>;
    type PrimType = Type.Number | Type.String | Type.Boolean | Type.Enum<string>;
    type Type = PrimType | Type.Array<PrimType> | Type.Union<PrimType | Type.Undefined>;
    type InferArgs<A extends Args> = {
        [K in keyof A]: Schema.InferOutput<A[K]['type']>;
    };
    type Arg = FieldMeta & {
        type: Type;
    };
}
export declare const cmd: {
    <const N extends string, const A extends Cmd.Args, const P extends (keyof A)[]>(p: Cmd<N, A, P>): Cmd.CmdOp<N, A, P>;
    <N extends string, I extends Input = Input, O extends Output = Output>(p: Api<Operation<N, I, O>>): Api<Operation<N, I, O>>;
    <const O extends Api<Namespace>>(p: O): O;
};
export declare const flag: () => import("@lickle/api").Tp<Type.Boolean>;
export declare const string: () => import("@lickle/api").Tp<Type.String>;
export declare const num: () => import("@lickle/api").Tp<Type.Number>;
export declare const list: () => import("@lickle/api").Tp<Type.Array<import("@lickle/api").Tp<Type.String>>>;
export declare const optional: () => never;
//# sourceMappingURL=build.d.ts.map