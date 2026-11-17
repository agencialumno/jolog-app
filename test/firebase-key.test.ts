import { describe, expect, it } from 'vitest';
import { normalizePrivateKey } from '../src/lib/server/firebase';

describe('normalizePrivateKey', () => {
	it('converte \n literal em quebra de linha', () => {
		expect(normalizePrivateKey('a\nb\nc')).toBe('a\nb\nc');
		expect(normalizePrivateKey(undefined)).toBeUndefined();
	});
});
