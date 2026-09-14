import type { Schema, Type } from '../types.ts';
export declare const getJson: (schema: Schema) => any;
export declare const getMeta: (schema: Schema) => {
    default?: unknown;
    description?: string;
};
export declare const getDefault: (object: Type.Object<any>, field: string) => {
    value: any;
} | undefined;
//# sourceMappingURL=schema.d.ts.map