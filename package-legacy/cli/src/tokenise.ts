export interface Token {
  /** Flag name as written, without dashes. Absent for a positional argument. */
  name?: string
  /** How it was written, for messages: `--tag`, `-t`. */
  display: string
  /** The value given, or `true` for a flag written without one. */
  value: string | true
}

/**
 * Split an argv into flags and positionals.
 *
 * Purely syntactic, and it never throws: it reports what was written and leaves
 * every judgement to the caller. The only thing the grammar needs to know about
 * the operation is which flags consume the next word, which arrives as
 * `takesValue` — so the runner can run this same grammar over a raw argv
 * knowing only the reserved flags and get the same answer the real parse will.
 * One grammar, one implementation.
 *
 * Supports `--name value`, `--name=value`, `-n value`, `-n=value`, grouped short
 * flags (`-abc`), and `--` to end flag parsing. `--no-name` comes back as a flag
 * named `no-name`; resolving that against the operation is the caller's job.
 */
export const tokenise = (argv: string[], takesValue: (name: string) => boolean): Token[] => {
  const out: Token[] = []
  let i = 0
  let flagsEnded = false

  const next = (): string | undefined => argv[i++]

  /**
   * Consume one flag. Returns true when it used `inline` as its value.
   *
   * `explicit` distinguishes a value written with `=` from the tail of a short
   * cluster: in `-fv` the `v` is another flag, not the value of `-f`.
   */
  const flag = (name: string, display: string, inline: string | undefined, explicit: boolean): boolean => {
    if (!takesValue(name)) {
      const given = explicit && inline !== undefined
      out.push({ name, display, value: given ? inline! : true })
      return given
    }
    const raw = inline ?? next()
    out.push({ name, display, value: raw ?? true })
    return inline !== undefined
  }

  while (i < argv.length) {
    const arg = argv[i++]!

    if (flagsEnded || arg === '-' || !arg.startsWith('-')) {
      out.push({ display: arg, value: arg })
      continue
    }
    if (arg === '--') {
      flagsEnded = true
      continue
    }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
      flag(name, `--${name}`, eq === -1 ? undefined : arg.slice(eq + 1), true)
      continue
    }

    // Short flags: `-n=value`, or a cluster where each char is a flag and the
    // first one that takes a value swallows the rest of the cluster.
    const body = arg.slice(1)
    if (body[1] === '=') {
      flag(body[0]!, `-${body[0]}`, body.slice(2), true)
      continue
    }
    for (let c = 0; c < body.length; c++) {
      const rest = body.slice(c + 1)
      if (flag(body[c]!, `-${body[c]}`, rest === '' ? undefined : rest, false)) break
    }
  }

  return out
}
