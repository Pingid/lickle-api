import { type AnyOperation, type Api, type Namespace } from '../types.ts';
/** A node in the tree, with the path that reaches it. */
export interface Located<T> {
    /** Segments leading here, program name excluded. */
    path: string[];
    node: T;
}
/**
 * Match one path segment against a namespace's children.
 *
 * There is no `children()` helper: since every namespace is named, a
 * namespace's children are exactly its `cmds`.
 */
export declare const findChild: (ns: Namespace | Api<Namespace>, segment: string) => AnyOperation | Namespace | undefined;
/**
 * A node a target does not want, and does not want walked into.
 *
 * Core never decides what this means — it takes the predicate. That is what
 * lets MCP hide a whole namespace of tools without core learning the word
 * "hidden".
 */
export type Skip = (node: AnyOperation | Namespace) => boolean;
/** Every node in the tree, depth first, each with the path that reaches it. */
export declare const walk: (ns: Namespace, skip?: Skip, path?: string[]) => Located<AnyOperation | Namespace>[];
/**
 * Every callable operation<> in the tree, with its path. Namespaces contribute path
 * segments but are not themselves callable, so only leaves appear.
 *
 * This is the shape every target consumes: a target is a function from these to
 * whatever it emits.
 */
export declare const operations: (ns: Namespace, skip?: Skip) => Located<AnyOperation>[];
/** Collect the inputs for an operation. */
export declare const collectInputs: (op: AnyOperation, get: (key: string) => {
    value: any;
} | undefined) => Res;
type Res = {
    ok: true;
    value: Record<string, any>;
} | {
    ok: false;
    missing: string[];
};
export {};
//# sourceMappingURL=visit.d.ts.map