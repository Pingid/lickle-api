import { choice, cmd, field, isNamespace, string, valuesOf, walk } from '@lickle/cmd-core'
import type { Command, Namespace, Operation } from '@lickle/cmd-core'
import { isBoolFlag } from './kind.ts'
import { cli, positionalsOf } from './meta.ts'
import { FORMATS } from './output.ts'
import { isList } from '@lickle/cmd-core'
import type { InputField } from '@lickle/cmd-core'

export const SHELLS = ['bash', 'zsh', 'fish'] as const

export type Shell = (typeof SHELLS)[number]

export const isShell = (v: string): v is Shell => (SHELLS as readonly string[]).includes(v)

export interface CompletionOpts {
  /** Program name the script registers against. Defaults to the root namespace's name. */
  name?: string
}

/** One command or namespace, flattened out of the tree for the emitters. */
interface Node {
  /** Segments reaching this node, program name excluded. Empty for the root. */
  path: string[]
  description: string
  subcommands: { name: string; description: string }[]
  options: Option[]
  /** Choices for positionals that declare `values`, offered as bare words. */
  positionalValues: string[]
}

interface Option {
  /** Every spelling of the flag: `-t`, `--tag`, `--tags`. */
  names: string[]
  description: string
  takesValue: boolean
  /** A list input, so the flag may be given more than once. */
  repeatable: boolean
  values?: string[]
}

/** Flags every command answers to. See RESERVED in parse.ts. */
const GLOBAL_OPTIONS: Option[] = [
  { names: ['-h', '--help'], description: 'Show this help.', takesValue: false, repeatable: false },
  {
    names: ['-o', '--output'],
    description: 'Output format.',
    takesValue: true,
    repeatable: false,
    values: [...FORMATS],
  },
]

/**
 * Generate a completion script for one shell from a command tree.
 *
 * The whole tree is baked into the script, so completion costs nothing at the
 * prompt — but the script has to be regenerated whenever the CLI changes.
 */
export const completion = (tree: Namespace, shell: Shell, opts: CompletionOpts = {}): string => {
  const name = opts.name ?? tree.name
  const nodes = flatten(tree)
  return shell === 'bash' ? bash(name, nodes) : shell === 'zsh' ? zsh(name, nodes) : fish(name, nodes)
}

const flatten = (root: Namespace): Node[] => [
  {
    path: [],
    description: root.description ?? '',
    subcommands: subcommandsOf(root),
    options: GLOBAL_OPTIONS,
    positionalValues: [],
  },
  ...walk(root).map(({ path, node }) => ({
    path,
    description: node.description ?? '',
    subcommands: isNamespace(node) ? subcommandsOf(node) : [],
    options: isNamespace(node) ? GLOBAL_OPTIONS : [...optionsOf(node), ...GLOBAL_OPTIONS],
    positionalValues: isNamespace(node) ? [] : positionalValuesOf(node),
  })),
]

const subcommandsOf = (ns: Namespace) =>
  ns.cmds.map(({ name, description }) => ({ name, description: description ?? '' }))

/** Inputs become flags, minus the ones bound as positionals. */
const optionsOf = (op: Operation): Option[] =>
  Object.entries(op.inputs ?? {})
    .filter(([key]) => !positionalsOf(op).includes(key))
    .map(([key, f]) => {
      const values = valuesOf(f.type)
      return {
        names: flagNames(key, f),
        description: f.description,
        takesValue: !isBoolFlag(f.type),
        repeatable: isList(f.type),
        ...(values === undefined ? {} : { values: values.map(String) }),
      }
    })

/** Positionals with a fixed set of choices, e.g. `completions <bash|zsh|fish>`. */
const positionalValuesOf = (op: Operation): string[] =>
  positionalsOf(op).flatMap((key) => {
    const f = op.inputs?.[key]
    return f === undefined ? [] : (valuesOf(f.type) ?? []).map(String)
  })

/** Same spellings the help column lists: shorts, the key, then long aliases. */
const flagNames = (key: string, f: InputField): string[] => {
  const aliases = f.alias ?? []
  return [
    ...aliases.filter((a) => a.length === 1).map((a) => `-${a}`),
    `--${key}`,
    ...aliases.filter((a) => a.length > 1).map((a) => `--${a}`),
  ]
}

// ---------------- Escaping --------------------------

/** Single-quote for bash and zsh, where `'` ends the quote and must be spliced. */
const sq = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/** Fish accepts a backslash escape inside single quotes. */
const fq = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** A shell function name: the program name with anything exotic flattened out. */
const fnName = (name: string): string => `_${name.replace(/[^A-Za-z0-9]/g, '_')}`

/** `[` `]` and `:` are structural inside an `_arguments` spec. */
const zshBracket = (s: string): string => s.replace(/[[\]:]/g, ' ')

/** The value label zsh shows while completing a flag's argument. */
const zshLabel = (o: Option): string => (o.names[o.names.length - 1] ?? 'value').replace(/^-+/, '')

const words = (node: Node): string[] => [
  ...node.subcommands.map((s) => s.name),
  ...node.positionalValues,
  ...node.options.flatMap((o) => o.names),
]

/** Key a node by its path, for the dispatch tables the scripts switch on. */
const pathKey = (path: string[]): string => path.join(' ')

// ---------------- bash --------------------------

/**
 * A single function registered with `complete -F`. It replays the words typed
 * so far against the known command paths, then offers that node's words.
 */
const bash = (name: string, nodes: Node[]): string => {
  const fn = `${fnName(name)}_complete`

  const wordCases = nodes.map((n) => `    ${sq(pathKey(n.path))}) opts=${sq(words(n).join(' '))} ;;`).join('\n')

  // Flags carrying a fixed set of values, keyed by "<path>|<flag>".
  const withValues = nodes.flatMap((n) =>
    n.options
      .filter((o) => o.values !== undefined)
      .flatMap((o) => o.names.map((flag) => ({ key: `${pathKey(n.path)}|${flag}`, values: o.values! }))),
  )

  /** The same case table, completing against whichever word holds the value. */
  const valueCases = (against: string, indent: string): string =>
    withValues.length === 0
      ? `${indent}*) ;;`
      : withValues
          .map(
            (v) =>
              `${indent}${sq(v.key)}) COMPREPLY=( $(compgen -W ${sq(v.values.join(' '))} -- "${against}") ) ; return 0 ;;`,
          )
          .join('\n')

  // Pipe-delimited so a path containing spaces cannot be matched piecemeal.
  const list = (items: string[]) => `${items.map((p) => `|${p}`).join('')}|`
  const paths = list(nodes.filter((n) => n.path.length > 0).map((n) => pathKey(n.path)))
  const leaves = list(nodes.filter((n) => n.subcommands.length === 0).map((n) => pathKey(n.path)))
  // Flags that consume the next word, so it is not mistaken for a command.
  const valueFlags = list([
    ...new Set(nodes.flatMap((n) => n.options.filter((o) => o.takesValue)).flatMap((o) => o.names)),
  ])

  return `# ${name} completions for bash.
# Generated from the command tree — regenerate when the CLI changes.
# Install: ${name} completions bash > /etc/bash_completion.d/${name}

${fn}() {
  local cur prev path candidate word i opts stray=0
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Replay the words to find the deepest command path typed so far. Flag values
  # are skipped, and once a leaf command is reached the rest are its arguments.
  path=""
  for (( i=1; i < COMP_CWORD; i++ )); do
    word="\${COMP_WORDS[i]}"
    case "$word" in
      *=*) continue ;;
      -*)
        case "${valueFlags}" in *"|$word|"*) (( i++ )) ;; esac
        continue
        ;;
    esac
    if [[ -n "$path" ]]; then candidate="$path $word"; else candidate="$word"; fi
    case "${paths}" in
      *"|$candidate|"*) path="$candidate" ;;
      # A word that names no command is a typo: stop guessing.
      *) stray=1; break ;;
    esac
    case "${leaves}" in *"|$path|"*) break ;; esac
  done

  if (( stray )); then return 0; fi

  # A flag with a fixed set of values takes priority over the word list.
  case "$path|$prev" in
${valueCases('$cur', '    ')}
  esac

  # An unfinished --flag=value completes against that flag's values.
  if [[ "$cur" == *=* ]]; then
    case "$path|\${cur%%=*}" in
${valueCases('${cur#*=}', '      ')}
    esac
  fi

  case "$path" in
${wordCases}
    *) opts="" ;;
  esac

  COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
  return 0
}

complete -F ${fn} ${name}
`
}

// ---------------- zsh --------------------------

/**
 * `_arguments` per command path, so every candidate carries its description.
 * Groups dispatch into a nested function; leaves list their flags.
 */
const zsh = (name: string, nodes: Node[]): string => {
  const fn = fnName(name)

  const nodeFn = (n: Node): string => {
    const label = n.path.length === 0 ? fn : `${fn}_${n.path.join('_').replace(/[^A-Za-z0-9_]/g, '_')}`

    const args = n.options.flatMap((o) => {
      // `_arguments` reads the trailing `:label:action` as "this flag takes a
      // value"; without it zsh would complete the flag as a bare switch.
      const arg = o.takesValue ? `:${zshLabel(o)}:${o.values ? `(${o.values.join(' ')})` : ''}` : ''
      const repeat = o.repeatable ? '*' : ''
      return o.names.map((flag) => `    ${sq(`${repeat}${flag}[${zshBracket(o.description)}]${arg}`)} \\`)
    })

    if (n.subcommands.length === 0) {
      const positional = n.positionalValues.length > 0 ? `    '1: :(${n.positionalValues.join(' ')})' \\\n` : ''
      return `${label}() {
  _arguments -s \\
${args.join('\n')}
${positional}    '*:: :->args'
}`
    }

    const describe = n.subcommands.map((s) => `    ${sq(`${s.name}:${s.description.replace(/:/g, ' ')}`)}`).join('\n')
    return `${label}() {
  local -a commands
  commands=(
${describe}
  )
  _arguments -C \\
${args.join('\n')}
    '1: :->command' \\
    '*:: :->args'

  case "$state" in
    command) _describe -t commands 'command' commands ;;
    args)
      case "\${words[1]}" in
${n.subcommands
  .map((s) => `        ${sq(s.name)}) ${label}_${s.name.replace(/[^A-Za-z0-9_]/g, '_')} 2>/dev/null || _default ;;`)
  .join('\n')}
      esac
      ;;
  esac
}`
  }

  return `#compdef ${name}
# ${name} completions for zsh.
# Generated from the command tree — regenerate when the CLI changes.
# Install: ${name} completions zsh > "\${fpath[1]}/_${name}"

${nodes.map(nodeFn).join('\n\n')}

${fn} "$@"
`
}

// ---------------- fish --------------------------

/**
 * One `complete` line per candidate. Depth is expressed with
 * `__fish_seen_subcommand_from`, which fish provides for exactly this.
 */
const fish = (name: string, nodes: Node[]): string => {
  /**
   * A node's candidates apply once its own path is on the line but before the
   * line descends into one of its children — otherwise `app db migrate` would
   * still be offered `db`'s sibling commands.
   */
  const condition = (n: Node): string => {
    // At the root `__fish_use_subcommand` already means "nothing chosen yet".
    if (n.path.length === 0) return '__fish_use_subcommand'
    const seen = n.path.map((segment) => `__fish_seen_subcommand_from ${segment}`)
    const notDeeper =
      n.subcommands.length > 0 ? [`not __fish_seen_subcommand_from ${n.subcommands.map((s) => s.name).join(' ')}`] : []
    return [...seen, ...notDeeper].join('; and ')
  }

  const lines = nodes.flatMap((n) => {
    const when = condition(n)

    const subs = n.subcommands.map((s) => `complete -c ${name} -n ${fq(when)} -a ${fq(s.name)} -d ${fq(s.description)}`)

    const positional =
      n.positionalValues.length > 0 ? [`complete -c ${name} -n ${fq(when)} -a ${fq(n.positionalValues.join(' '))}`] : []

    const opts = n.options.flatMap((o) =>
      o.names.map((flag) => {
        const form = flag.startsWith('--') ? `-l ${flag.slice(2)}` : `-s ${flag.slice(1)}`
        const takes = o.takesValue ? ' -r' : ''
        const values = o.values ? ` -a ${fq(o.values.join(' '))}` : ''
        return `complete -c ${name} -n ${fq(when)} ${form}${takes} -d ${fq(o.description)}${values}`
      }),
    )

    return [...subs, ...positional, ...opts]
  })

  return `# ${name} completions for fish.
# Generated from the command tree — regenerate when the CLI changes.
# Install: ${name} completions fish > ~/.config/fish/completions/${name}.fish

${lines.join('\n')}
`
}

// ---------------- The command --------------------------

// A single unnamed output: the result is a script, not a set of named fields,
// so the CLI prints it verbatim rather than as `key: value` lines.
const completionsOp = cli(
  {
    name: 'completions',
    description: 'Print a shell completion script.',
    inputs: {
      shell: field({ description: 'Shell to generate for.', type: choice(SHELLS) }),
    },
    outputs: field({ description: 'The completion script.', type: string }),
  },
  { positionals: ['shell'] },
)

/**
 * A `completions <shell>` command for a tree.
 *
 * The tree is passed as a thunk because the command lives inside the tree it
 * describes; it is read when the command runs, by which point the tree exists.
 * Most callers want {@link withCompletions} instead.
 */
export const completionsCmd = (tree: () => Namespace, opts: CompletionOpts = {}): Command =>
  // `i.shell` is `Shell`, not `string`: the choice type reports its members, and
  // `bind` has already rejected anything outside them.
  cmd(completionsOp, (i) => completion(tree(), i.shell, opts))

/** Append a `completions` command to a namespace, wired to that same namespace. */
export const withCompletions = (tree: Namespace, opts: CompletionOpts = {}): Namespace => {
  const out: Namespace = { ...tree, cmds: [...tree.cmds, completionsCmd(() => out, opts)] }
  return out
}
