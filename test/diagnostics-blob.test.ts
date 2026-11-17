import { afterEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@vercel/blob', () => ({
	put: vi.fn(
		async (p: string, body: string) => (
			store.set(p, body),
			{ url: `https://blob.test/${p}`, downloadUrl: `https://blob.test/${p}?d=1` }
		)
	),
	get: vi.fn(async (p: string) => ({ statusCode: 200, stream: new Response(store.get(p)).body })),
	del: vi.fn(async (p: string) => void store.delete(p))
}));
import { checkBlobPrivate } from '../src/lib/server/diagnostics';

afterEach(() => vi.unstubAllGlobals());

describe('checkBlobPrivate', () => {
	it('ok quando URL sem auth responde 403; apaga o arquivo', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('denied', { status: 403 }))
		);
		const r = await checkBlobPrivate('t');
		expect(Object.values(r).every((s) => s.ok)).toBe(true);
		expect(store.size).toBe(0);
	});
	it('falha se a URL entrega o conteudo sem autenticacao', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response([...store.values()][0], { status: 200 }))
		);
		const r = await checkBlobPrivate('t');
		expect(r.sem_url_publica.ok).toBe(false);
		expect(store.size).toBe(0);
	});
});
