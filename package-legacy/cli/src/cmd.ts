/**
 * The operation-building surface, re-exported so this package is enough on its
 * own: `import { run } from '@lickle/legacy-cli'` for what this target does,
 * `import { cmd, field, string } from '@lickle/legacy-cli/cmd'` for describing the
 * operations it runs.
 *
 * Depending on `@lickle/legacy-api` directly works too, and is what you want when
 * a package defines operations without running them.
 */
export * from '@lickle/legacy-api'
