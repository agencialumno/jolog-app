import { describe, expect, it } from 'vitest';
import { formatCep, lookupCep } from './viacep';

describe('viacep', () => {
	it('formata CEP', () => {
		expect(formatCep('01310100')).toBe('01310-100');
		expect(formatCep('0131')).toBe('0131');
	});
	it('busca e trata CEP inexistente', async () => {
		const ok = (async () =>
			new Response(JSON.stringify({ logradouro: 'Av X', bairro: 'B', localidade: 'SP', uf: 'SP' }))) as typeof fetch;
		const bad = (async () => new Response(JSON.stringify({ erro: true }))) as typeof fetch;
		expect(await lookupCep('01310-100', ok)).toEqual({ street: 'Av X', district: 'B', city: 'SP', state: 'SP' });
		expect(await lookupCep('01310-100', bad)).toBeNull();
		expect(await lookupCep('123', ok)).toBeNull();
	});
});
