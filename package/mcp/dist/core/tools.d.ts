import type { Api, Namespace, Operation } from '@lickle/api';
import { bind } from '@lickle/api/util';
import type { McpMeta } from '../meta.ts';
import { type NamePolicy } from './names.ts';
import type { Tool } from './wire.ts';
/** One operation as a tool, with everything a call will need decided in advance. */
export interface ToolEntry {
    tool: Tool;
    op: Operation.Any;
    path: string[];
    /** Its inputs, read once, so a call does not read the schema again. */
    inputs: bind.Inputs;
    /** It declares an `outputSchema`, so its result carries `structuredContent`. */
    structured: boolean;
    /** It streams, so a call drains it before answering. */
    stream: boolean;
}
export interface ToolsOpts {
    naming?: NamePolicy;
    /** Where to report a name collision. Never stdout — that carries the protocol. */
    onWarn?: (message: string) => void;
}
export declare const nodeMeta: (node: object) => McpMeta;
/**
 * A node this target does not publish, and does not walk into.
 *
 * Hiding a namespace takes its subtree with it, which is what `Skip` is for:
 * core never learns the word "hidden", it only takes the predicate.
 */
export declare const isHidden: (node: Operation.Any | Namespace) => boolean;
/**
 * Every callable operation in the tree, as a tool.
 *
 * A tree is nested and a tool list is flat, so the path becomes the name — and
 * that is the only real work here. Everything else is read off the operation,
 * which is why a command written for a command line and an operation written for
 * no target at all both arrive here as tools without either knowing.
 */
export declare const tools: (program: Api.Program, opts?: ToolsOpts) => ToolEntry[];
//# sourceMappingURL=tools.d.ts.map