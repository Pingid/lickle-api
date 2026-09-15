import { expect, test } from 'vitest';
import { tokenise } from './tokenise.js';
/** Only `--tag`/`-t` consume the next word, which is what an operation would say. */
const takesValue = (name) => name === 'tag' || name === 't';
const parts = (argv) => tokenise(argv, takesValue).map((t) => [t.name ?? null, t.value]);
test('reads a long flag written either way', () => {
    expect(parts(['--tag', 'home'])).toEqual([['tag', 'home']]);
    expect(parts(['--tag=home'])).toEqual([['tag', 'home']]);
});
test('reads a short flag written either way', () => {
    expect(parts(['-t', 'home'])).toEqual([['t', 'home']]);
    expect(parts(['-t=home'])).toEqual([['t', 'home']]);
});
test('a flag that takes no value is `true`, and keeps an explicit one', () => {
    expect(parts(['--done'])).toEqual([['done', true]]);
    expect(parts(['--done=false'])).toEqual([['done', 'false']]);
});
test('groups short flags, and the first that takes a value swallows the rest', () => {
    expect(parts(['-abc'])).toEqual([
        ['a', true],
        ['b', true],
        ['c', true],
    ]);
    expect(parts(['-dt', 'home'])).toEqual([
        ['d', true],
        ['t', 'home'],
    ]);
    expect(parts(['-dthome'])).toEqual([
        ['d', true],
        ['t', 'home'],
    ]);
});
test('positionals keep their order, and `--` ends flag parsing', () => {
    expect(parts(['one', '--tag', 'home', 'two'])).toEqual([
        [null, 'one'],
        ['tag', 'home'],
        [null, 'two'],
    ]);
    expect(parts(['--', '--tag', '-x'])).toEqual([
        [null, '--tag'],
        [null, '-x'],
    ]);
    expect(parts(['-'])).toEqual([[null, '-']]);
});
test('a negated flag comes back by the name that was written', () => {
    expect(parts(['--no-done'])).toEqual([['no-done', true]]);
});
test('a value-taking flag at the end of argv has nothing to take', () => {
    expect(parts(['--tag'])).toEqual([['tag', true]]);
});
//# sourceMappingURL=tokenise.test.js.map