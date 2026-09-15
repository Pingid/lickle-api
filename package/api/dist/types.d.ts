import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';
import type { Computed, Intersect } from './util/index.ts';
export declare const API = "@lickle/api-legacy:1.0.0";
export interface Api<T extends Operation.Any | Namespace.Any = Operation.Any | Namespace.Any> {
    [API]: T;
}
export declare namespace Api {
    type Program = Operation.Any | Namespace.Any | Api<Operation.Any | Namespace.Any>;
    type Extract<T> = T extends Api ? T[typeof API] : T;
    type Wrap<T extends Operation.Any | Namespace.Any | Api> = T extends Operation.Any | Namespace.Any ? Api<T> : T;
}
export interface Operation<N extends string, I extends Operation.Input = Operation.Input, O extends Operation.Output = Operation.Output, C extends Operation.Cx = void> extends Operation.Spec<N, I, O>, Operation.Handler<Operation.InferIn<I>, Operation.InferOut<O>, C> {
}
export declare namespace Operation {
    interface Spec<N, I, O> {
        name: N;
        description?: string;
        in: I;
        out: O;
    }
    interface Handler<I, O, C = void> {
        handle: (input: I, context: C) => O;
    }
    type Any = Operation<any, any, any, any>;
    interface Input extends Schema<unknown, Record<string, any>> {
    }
    type InferIn<S extends Input> = Schema.InferOutput<S>;
    interface Output extends Schema {
        returns?: 'sync' | 'async-iter';
    }
    type Returns = 'sync' | 'async-iter';
    type Cx = Record<string, unknown> | void;
    type InferOut<S extends Output> = S['returns'] extends 'async-iter' ? AsyncIterable<Schema.InferOutput<S>> : S['returns'] extends 'sync' ? Schema.InferOutput<S> : Promise<Schema.InferOutput<S>>;
}
export interface Namespace<N extends string = string, O extends (Api<any> | Operation.Any | Namespace.Any)[] = (Api<any> | Operation.Any | Namespace.Any)[]> {
    name: N;
    description?: string;
    operations: O;
}
export declare namespace Namespace {
    type Any = Namespace<any, any>;
    type DecendTree<T, Sep extends string = '/', N extends string = ''> = T extends Api<infer I> ? DecendTree<I, Sep, N> : T extends Operation.Any ? {
        [ky in `${N}${Sep}${T['name']}`]: T;
    } : T extends Namespace.Any ? DecendTree<T['operations'][number], Sep, `${N}${Sep}${T['name']}`> : never;
    type FlattenTree<T, Sep extends string = '/'> = Computed<Intersect<DecendTree<T, Sep>>>;
    type CxTree<T> = 0 extends 1 & T ? void : T extends Operation<any, any, any, infer C> ? 0 extends 1 & C ? void : C : T extends Namespace<any, any> ? CxTree<T['operations'][number]> : T extends Api<infer I> ? CxTree<I> : void;
    type Cx<T> = Computed<Intersect<CxTree<T>>>;
}
export interface Schema<Input = unknown, Output = Input> extends Schema.Standard<Input, Output> {
    description?: string;
}
export declare namespace Schema {
    interface Standard<I = unknown, O = I> extends StandardJSONSchemaV1<I, O> {
        readonly '~standard': StandardJSONSchemaV1.Props<I, O> & Partial<StandardSchemaV1.Props<I, O>>;
    }
    type InferInput<S extends StandardJSONSchemaV1> = StandardJSONSchemaV1.InferInput<S>;
    type InferOutput<S extends StandardJSONSchemaV1> = StandardJSONSchemaV1.InferOutput<S>;
    type Props<I, O> = StandardJSONSchemaV1.Props<I, O>;
}
export declare namespace Type {
    interface Void extends Schema<unknown, void> {
        type: 'void';
    }
    interface Number extends Schema<unknown, number> {
        type: 'number';
    }
    interface String extends Schema<unknown, string> {
        type: 'string';
    }
    interface Boolean extends Schema<unknown, boolean> {
        type: 'boolean';
    }
    interface Null extends Schema<unknown, null> {
        type: 'null';
    }
    interface Undefined extends Schema<unknown, undefined> {
        type: 'undefined';
    }
    interface Unknown extends Schema<unknown, unknown> {
        type: 'unknown';
    }
    interface Any extends Schema<unknown, any> {
        type: 'any';
    }
    interface Array<T extends Schema = Schema> extends Schema<unknown, Schema.InferOutput<T>[]> {
        type: 'array';
        items: T;
    }
    interface Enum<T extends string> extends Schema<unknown, T> {
        type: 'enum';
        enum: T[];
    }
    interface Union<T extends Schema> extends Schema<unknown, Schema.InferOutput<T>> {
        type: 'union';
        oneOf: T[];
    }
    interface Object<T extends Fields> extends Schema<unknown, Fields.Infer<T>> {
        type: 'object';
        properties: T;
    }
    type Builtin = Void | Number | String | Boolean | Null | Undefined | Unknown | Any | Array | Enum<string> | Union<any> | Object<any>;
}
export interface Fields extends Record<string, Fields.Field> {
}
export declare namespace Fields {
    type Field = Schema & {
        optional?: true;
    };
    type Properties = Record<string, Field>;
    type Keys<T extends Properties, Kind extends 'O' | 'R' = 'R'> = {
        [K in keyof T]: T[K] extends {
            optional: true;
        } ? {
            O: K;
            R: never;
        }[Kind] : {
            O: never;
            R: K;
        }[Kind];
    }[keyof T];
    type Infer<T extends Properties> = Compute<{
        [K in Keys<T, 'R'>]: Schema.InferOutput<T[K]>;
    } & {
        [K in Keys<T, 'O'>]?: Schema.InferOutput<T[K]> | undefined;
    }>;
    type Compute<T> = {
        [K in keyof T]: T[K];
    } & {};
}
//# sourceMappingURL=types.d.ts.map