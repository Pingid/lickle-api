/**
 * Giving the nodes of a tree names a flat namespace can hold.
 *
 * A command line navigates a tree one segment at a time, so it never needs this.
 * A target that publishes every operation at once does: a tool list, a route
 * table, a directory of generated actions. Each has its own idea of what a name
 * may contain and how long it may be, so this states none of it — every rule
 * arrives from the caller, and what is here is only the part that is easy to get
 * wrong: a collision suffix has to be carved out of the length cap rather than
 * appended past it.
 */
export interface Naming {
    /** Joins the segments. Defaults to `_`. */
    separator?: string;
    /** Characters kept. Anything else becomes `replacement`. */
    allow?: RegExp;
    replacement?: string;
    /** The longest a name may be, collision suffix included. Uncapped by default. */
    max?: number;
    /** Applied after joining and before the charset is enforced — lowercasing, say. */
    transform?: (name: string) => string;
    /** Names already spoken for: a target with reserved words passes them here. */
    taken?: Iterable<string>;
}
export interface Named {
    path: readonly string[];
    name: string;
    /** What it would have been, when a collision moved it. */
    wanted?: string;
}
/**
 * Every path as a distinct name, in the order given.
 *
 * A collision is reported rather than announced — `wanted` says a name moved,
 * and where that is said is the target's business. An MCP server in particular
 * must never say it on stdout, which carries the protocol.
 */
export declare const names: (paths: readonly (readonly string[])[], opts?: Naming) => Named[];
//# sourceMappingURL=name.d.ts.map