import { describe, expect, it } from 'vitest';
import { authErrorMessage, validateCredentials } from '../src/lib/auth/errors';
import { whatsappUrl } from '../src/lib/whatsapp';
import { allowedOrigin, corsHeaders } from '../src/lib/server/cors';

describe('mensagens de erro em português', () => {
	it.each([
		['auth/invalid-credential', 'E-mail ou senha incorretos.'],
		['auth/email-already-in-use', 'Já existe uma conta com este e-mail. Tente entrar.'],
		['auth/weak-password', 'Senha fraca. Use pelo menos 8 caracteres.'],
		['auth/network-request-failed', 'Sem conexão. Verifique a internet e tente de novo.']
	])('%s', (code, msg) => expect(authErrorMessage({ code })).toBe(msg));
	it('não vaza detalhe técnico', () => {
		expect(authErrorMessage(new Error('boom: secret'))).toBe('Algo deu errado. Tente novamente.');
		expect(authErrorMessage({ code: 'auth/xyz' })).not.toContain('xyz');
		expect(authErrorMessage({ status: 500 })).toContain('cadastro');
	});
});

describe('validateCredentials', () => {
	it('entrar', () => {
		expect(validateCredentials({ email: '', password: 'x' }, 'entrar')).toMatch(/e-mail/);
		expect(validateCredentials({ email: 'a@b', password: 'x' }, 'entrar')).toMatch(/inválido/);
		expect(validateCredentials({ email: 'a@b.com', password: '' }, 'entrar')).toMatch(/senha/);
		expect(validateCredentials({ email: 'a@b.com', password: 'x' }, 'entrar')).toBeNull();
	});
	it('cadastrar exige nome e senha de 8+', () => {
		expect(validateCredentials({ email: 'a@b.com', password: '12345678' }, 'cadastrar')).toMatch(/nome/);
		expect(validateCredentials({ email: 'a@b.com', password: '1234567', name: 'Ana' }, 'cadastrar')).toMatch(/8/);
		expect(validateCredentials({ email: 'a@b.com', password: '12345678', name: 'Ana' }, 'cadastrar')).toBeNull();
	});
});

describe('whatsappUrl', () => {
	it('monta wa.me só com dígitos e texto codificado', () => {
		expect(whatsappUrl('+55 (11) 99999-0000', 'Olá!')).toBe('https://wa.me/5511999990000?text=Ol%C3%A1!');
		expect(whatsappUrl('5511999990000')).toBe('https://wa.me/5511999990000');
	});
	it('sem número válido não há link', () => {
		expect(whatsappUrl(undefined)).toBeNull();
		expect(whatsappUrl('123')).toBeNull();
	});
});

describe('CORS do app', () => {
	it('libera origens do Capacitor e as extras; bloqueia o resto', () => {
		expect(allowedOrigin('capacitor://localhost', '')).toBe('capacitor://localhost');
		expect(allowedOrigin('https://app.exemplo.com', 'https://app.exemplo.com, https://b.com')).toBe(
			'https://app.exemplo.com'
		);
		expect(allowedOrigin('https://evil.com', '')).toBeNull();
		expect(allowedOrigin(null, '')).toBeNull();
		expect(corsHeaders('capacitor://localhost')['Access-Control-Allow-Headers']).toContain('Authorization');
	});
});
