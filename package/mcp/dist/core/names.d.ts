import { type Named } from '@lickle/api/util';
/**
 * What a tool may be called.
 *
 * The specification allows 1–128 characters of `A-Za-z0-9_-.`, and offers
 * `admin.tools.list` as an example — a dotted path, which is exactly the shape a
 * namespaced tree already has. The default here is narrower on purpose:
 * Claude's tool-use API has held to `[A-Za-z0-9_-]` within 64 characters, and a
 * spec-legal name refused by the host that will actually call it is worse than a
 * short one. A deep tree can opt into the full range.
 */
export interface NamePolicy {
    /** Joins the path segments. Defaults to `_`; `.` is also spec-legal. */
    separator?: string;
    /** Longest name allowed, collision suffix included. Defaults to 64; the spec allows 128. */
    max?: number;
}
export declare const toolNames: (paths: readonly (readonly string[])[], policy?: NamePolicy) => Named[];
//# sourceMappingURL=names.d.ts.map