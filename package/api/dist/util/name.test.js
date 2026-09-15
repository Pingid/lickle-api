import { expect, test } from 'vitest';
import { names } from './name.js';
const of = (paths, opts) => names(paths, opts).map((n) => n.name);
test('joins a path into one name', () => {
    expect(of([['db', 'migrate'], ['version']])).toEqual(['db_migrate', 'version']);
    expect(of([['db', 'migrate']], { separator: '.' })).toEqual(['db.migrate']);
});
test('keeps only the characters the caller allows', () => {
    expect(of([['my cmd', 'a/b']], { allow: /[A-Za-z0-9_-]/ })).toEqual(['my_cmd_a_b']);
    expect(of([['a b']], { allow: /[A-Za-z0-9-]/, replacement: '-' })).toEqual(['a-b']);
});
test('transforms before the charset is enforced, so a case change is not mangled', () => {
    expect(of([['DB', 'Migrate']], { transform: (n) => n.toLowerCase(), allow: /[a-z0-9-]/, separator: '-' })).toEqual([
        'db-migrate',
    ]);
});
test('truncates to the cap', () => {
    expect(of([['averyverylongname']], { max: 6 })).toEqual(['averyv']);
});
test('a collision takes a suffix, and says what it wanted', () => {
    const got = names([
        ['a', 'run'],
        ['b', 'run'],
    ], { separator: '', transform: (n) => n.slice(1) });
    expect(got.map((n) => n.name)).toEqual(['run', 'run_2']);
    expect(got[0].wanted).toBeUndefined();
    expect(got[1].wanted).toBe('run');
});
test('a suffix is carved out of the cap, not appended past it', () => {
    const got = of([['abcdef'], ['abcdef'], ['abcdef']], { max: 6 });
    expect(got).toEqual(['abcdef', 'abcd_2', 'abcd_3']);
    expect(got.every((n) => n.length <= 6)).toBe(true);
});
test('names already spoken for are avoided', () => {
    expect(of([['version']], { taken: ['version'] })).toEqual(['version_2']);
});
//# sourceMappingURL=name.test.js.map