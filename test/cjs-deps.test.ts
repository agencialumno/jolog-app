import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Regressao: jwks-rsa (via firebase-admin) faz require('jose'). Com jose ESM-only (v6+) o runtime da
// Vercel falha com ERR_REQUIRE_ESM e /api/* responde 500. O override em package.json fixa jose 5.x (CJS).
const req = createRequire(import.meta.url);

describe('dependencias CommonJS do firebase-admin', () => {
	it('jose e carregavel por require() e e 5.x', () => {
		const jose = req('jose');
		expect(typeof jose.importJWK).toBe('function');
		expect(typeof jose.exportSPKI).toBe('function');
		expect(Number(req('jose/package.json').version.split('.')[0])).toBeLessThan(6);
	});
	it('jwks-rsa carrega e converte um JWK em chave de assinatura', async () => {
		const { JwksClient } = req('jwks-rsa');
		const { generateKeyPair, exportJWK } = req('jose');
		const { publicKey } = await generateKeyPair('RS256', { extractable: true });
		const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', use: 'sig', alg: 'RS256' };
		const client = new JwksClient({ jwksUri: 'http://x/jwks', fetcher: async () => ({ keys: [jwk] }) });
		const key = await client.getSigningKey('k1');
		expect(key.getPublicKey()).toContain('BEGIN PUBLIC KEY');
	});
});
