import { t } from '@lickle/api';
export const cmd = (p) => p;
export const flag = () => t.boolean();
export const string = () => t.string();
export const num = () => t.number();
export const list = () => t.array(t.string());
export const optional = () => t.union([t.undefined()]);
//# sourceMappingURL=build.js.map