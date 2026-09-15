import { t } from '@lickle/api';
import { expect, test } from 'vitest';
import { isFormat, render, renderError } from './output.js';
const record = t.object({ id: t.number(), title: t.string(), tags: t.array(t.string()) });
test('text prints one line per field, ordered by the schema', () => {
    const value = { tags: ['home'], title: 'buy milk', id: 1 };
    expect(render(value, record, 'text')).toBe('id:    1\ntitle: buy milk\ntags:\n  - home');
});
test('text prints a single value bare', () => {
    expect(render('a script', t.string(), 'text')).toBe('a script');
    expect(render(['a', 'b'], t.array(t.string()), 'text')).toBe('a\nb');
    expect(render(42, t.number(), 'text')).toBe('42');
});
test('nothing to print prints nothing', () => {
    expect(render(undefined, t.void, 'text')).toBe('');
    expect(render(undefined, t.void, 'json')).toBe('');
    expect(render(null, record, 'text')).toBe('');
});
test('json prints the value verbatim', () => {
    expect(render({ id: 1 }, record, 'json')).toBe('{\n  "id": 1\n}');
});
test('fields the schema did not declare are still printed', () => {
    expect(render({ extra: 'x' }, record, 'text')).toBe('extra: x');
});
test('errors render in the format that was asked for', () => {
    expect(renderError(new Error('boom'), 'text')).toBe('error: boom');
    expect(renderError(new Error('boom'), 'json')).toBe('{\n  "error": {\n    "message": "boom"\n  }\n}');
    expect(renderError('a string', 'text')).toBe('error: a string');
});
test('knows the formats it offers', () => {
    expect(isFormat('json')).toBe(true);
    expect(isFormat('yaml')).toBe(false);
});
//# sourceMappingURL=output.test.js.map