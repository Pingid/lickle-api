import { type Namespace, type Operation } from '@lickle/api';
/** Help for a namespace: the commands it holds, plus the global options. */
export declare const namespaceHelp: (ns: Namespace, path: string[]) => string;
/** Help for a single operation: its arguments, its options and what it returns. */
export declare const operationHelp: (op: Operation.Any, path: string[]) => string;
//# sourceMappingURL=help.d.ts.map