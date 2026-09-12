import { Builder, Cmd, InputField, Inputs, KIND, OutputField, Outputs, Primitive, Run, Spec, Struct, Type } from "./types.ts";

// ---------------- Constructors --------------------------
export const spec = <const T extends Spec>(t: T) => t;

export const type = <const T extends Type>(t: T) => t;
export const num = type({ type: KIND.num });
export const string = type({ type: KIND.string });
export const bool = type({ type: KIND.bool });
export const optional = <T extends Primitive>(item: T) => type({ type: KIND.optional, item });
export const list = <T extends Primitive>(item: T) => type({ type: KIND.list, item });

export const field = <const T extends InputField | OutputField>(t: T) => t;

export const cmdFor = <const S extends Spec>(
  spec: S,
  run: (i: Inputs<S>) => Outputs<S> | Promise<Outputs<S>>,
): Cmd => ({ spec, run }) as any;

export const cmd = <const S extends Spec, const R extends Run<S>>(
  spec: S,
  run: R,
) => ({ spec, run }) as Cmd;

// ---------------- Builder --------------------------
export const build = <N extends string>(name: N): Builder<{ name: N }> => {
  const bld = (s: Struct) =>
    new Proxy(s, {
      get(target, prop) {
        if (prop === "spec") return () => target;
        if (prop === "cmd") return (run: any) => ({ spec: target, run });
        return (v: any) => bld({ ...target, [prop]: v });
      },
    });
  return bld({ name }) as Builder<{ name: N }>;
};
