import { expect, test } from 'vitest';
import { t } from '../build.js';
import * as api from './api.js';
import { findChild, operations, walk } from './visit.js';
const add = t.op({ name: 'add', description: 'Add.', handle: async () => { } });
const rm = t.op({ name: 'rm', description: 'Remove.', handle: async () => { } });
const tree = t.ns({
    name: 'todo',
    operations: [t.ns({ name: 'task', operations: [add, rm] }), t.op({ name: 'version', handle: async () => { } })],
});
test('walks every node, with the path that reaches it', () => {
    expect(walk(tree).map((l) => l.path.join('/'))).toEqual(['task', 'task/add', 'task/rm', 'version']);
});
test('only the leaves are callable', () => {
    expect(operations(tree).map((l) => l.path.join('/'))).toEqual(['task/add', 'task/rm', 'version']);
});
test('a node a target does not want is not walked into', () => {
    expect(operations(tree, (n) => n.name === 'task').map((l) => l.path.join('/'))).toEqual(['version']);
});
test('finds a child by the segment that names it', () => {
    expect(findChild(tree, 'version')?.name).toBe('version');
    expect(api.of(findChild(tree, 'task'))?.name).toBe('task');
    expect(findChild(tree, 'nope')).toBeUndefined();
});
test('a tree that refers to itself still has a type', () => {
    // A program that serves itself holds the operation that serves it, so its
    // type refers to its own. Reading the context a loosely typed tree needs has
    // to stop somewhere, and "it did not say" means it asks for nothing.
    const tree = t.ns({ name: 'todo', operations: [t.op({ name: 'echo', handle: async () => { } })] });
    const needs = undefined;
    expect(needs).toBeUndefined();
});
//# sourceMappingURL=visit.test.js.map