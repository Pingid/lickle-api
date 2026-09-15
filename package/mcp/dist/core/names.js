import { names } from '@lickle/api/util';
/** The characters the specification permits in a tool name. */
const ALLOW = /[A-Za-z0-9_.-]/;
export const toolNames = (paths, policy = {}) => names(paths, {
    separator: policy.separator ?? '_',
    max: policy.max ?? 64,
    allow: ALLOW,
    replacement: '_',
});
//# sourceMappingURL=names.js.map