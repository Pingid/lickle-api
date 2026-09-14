import type { AnyOperation, Namespace } from '../types.ts'

export const operation = (n: Namespace | AnyOperation): n is AnyOperation => 'handle' in n

export const namespace = (n: Namespace | AnyOperation): n is Namespace => !operation(n)
