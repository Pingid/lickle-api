/**
 * The operation-building surface, re-exported so this package is enough on its
 * own: `import { yml } from '@lickle/api-legacy-gha'` for what this target does,
 * `import { cmd, field, string } from '@lickle/api-legacy-gha/cmd'` for describing the
 * operations it runs.
 *
 * Depending on `@lickle/api-legacy` directly works too, and is what you want when
 * a package defines operations without running them.
 */
export * from '@lickle/api-legacy'
