import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('../src/lib/server/auth', () => ({ authenticate }));
const diag = vi.hoisted(() => ({ checkFirestore: vi.fn(), checkBlobPrivate: vi.fn() }));
vi.mock('../src/lib/server/diagnostics', async (orig) => ({ ...(await orig<object>()), ...diag }));

import { GET } from '../src/routes/api/diagnostics/+server';
import { normalizePrivateKey } from '../src/lib/server/firebase';

const call = (headers: Record<string, string> = {}) =>
	GET({ request: new Request('http://x/api/diagnostics', { headers }) } as Parameters<typeof GET>[0]);
const status = async (p: Response | Promise<Response>) =>
	Promise.resolve(p).then(
		() => 200,
		(e: { status: number }) => e.status
	);

beforeEach(() => {
	authenticate.mockReset();
	diag.checkFirestore.mockReset().mockResolvedValue({ escrita: { ok: true } });
	diag.checkBlobPrivate.mockReset().mockResolvedValue({ gravar: { ok: true } });
});

describe('/api/diagnostics bloqueio', () => {
	it('sem token -> 404 e nada e executado', async () => {
		authenticate.mockRejectedValue({ status: 401 });
		expect(await status(call())).toBe(404);
		expect(diag.checkFirestore).not.toHaveBeenCalled();
		expect(diag.checkBlobPrivate).not.toHaveBeenCalled();
	});
	it('token invalido -> 404', async () => {
		authenticate.mockRejectedValue(new Error('bad'));
		expect(await status(call({ authorization: 'Bearer lixo' }))).toBe(404);
	});
	it.each(['cliente', 'equipe', null])('papel %s -> 404', async (role) => {
		authenticate.mockResolvedValue({ uid: 'u', role });
		expect(await status(call({ authorization: 'Bearer t' }))).toBe(404);
		expect(diag.checkFirestore).not.toHaveBeenCalled();
	});
	it('admin -> 200 com so ok/erro por etapa', async () => {
		authenticate.mockResolvedValue({ uid: 'a', role: 'admin' });
		const r = await call({ authorization: 'Bearer t' });
		expect(r.status).toBe(200);
		expect(await r.json()).toEqual({
			ok: true,
			etapas: { firestore: { escrita: { ok: true } }, blob: { gravar: { ok: true } } }
		});
	});
});

describe('normalizePrivateKey', () => {
	it('converte \n literal em quebra de linha', () => {
		expect(normalizePrivateKey('a\nb\nc')).toBe('a\nb\nc');
		expect(normalizePrivateKey(undefined)).toBeUndefined();
	});
});
