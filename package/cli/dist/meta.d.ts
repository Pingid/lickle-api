import type { AnyOperation, Schema, Tp, Type, Op } from '@lickle/api';
export interface FieldMeta {
    aliases?: string[];
    short?: string;
}
declare module '@lickle/api/meta' {
    interface TypeMeta<T extends Schema> {
        cli: (m: FieldMeta) => Tp<T>;
    }
}
export interface OpMeta<T extends AnyOperation> {
    positionals?: Positionals<T['in']>;
    aliases?: {
        [K in keyof T['in']['properties']]?: string[];
    };
}
declare module '@lickle/api/meta' {
    interface OperationMeta<T extends AnyOperation> {
        cli: (m: OpMeta<T>) => Op<T>;
    }
}
type FieldsOf<T extends Schema, Extract extends 'Array' | 'Other' = 'Other'> = T extends Type.Object<any> ? {
    [K in keyof T['properties']]: T['properties'][K] extends Type.Array<any> ? {
        Array: K;
        Other: never;
    }[Extract] : {
        Array: never;
        Other: K;
    }[Extract];
}[keyof T['properties']] : never;
type Positionals<T extends Schema> = [...FieldsOf<T>[], FieldsOf<T> | FieldsOf<T, 'Array'>];
export {};
//# sourceMappingURL=meta.d.ts.map