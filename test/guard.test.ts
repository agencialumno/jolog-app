import { describe, expect, it } from 'vitest';
import { decide, homeFor, parseRole, safeNext } from '../src/lib/auth/guard';

const out = { ready: true, role: null } as const;
const as = (role: 'cliente' | 'equipe' | 'admin') => ({ ready: true, role });

describe('decide (guarda de rota)', () => {
	it('nada decide antes de a sessão estar pronta', () => {
		expect(decide('/pedidos', { ready: false, role: null })).toBeNull();
	});
	it.each(['/limpeza', '/lavanderia', '/vistoria', '/pedidos', '/conta', '/equipe', '/painel', '/completar-cadastro'])(
		'sem login: %s vai para /entrar com next',
		(p) => expect(decide(p, out)).toBe(`/entrar?next=${encodeURIComponent(p)}`)
	);
	it('sem login: home e telas de auth são públicas; barra final é normalizada', () => {
		for (const p of ['/entrar', '/cadastrar']) expect(decide(p, out)).toBeNull();
		expect(decide('/', out)).toBe('/entrar');
		expect(decide('/pedidos/', out)).toBe('/entrar?next=%2Fpedidos');
	});
	it('cliente acessa as telas de cliente e não as de equipe/admin', () => {
		for (const p of ['/', '/limpeza', '/pedidos', '/conta', '/completar-cadastro'])
			expect(decide(p, as('cliente'))).toBeNull();
		expect(decide('/equipe', as('cliente'))).toBe('/');
		expect(decide('/painel', as('cliente'))).toBe('/');
	});
	it('equipe e admin vão para a sua área', () => {
		expect(decide('/', as('equipe'))).toBe('/equipe');
		expect(decide('/limpeza', as('equipe'))).toBe('/equipe');
		expect(decide('/painel', as('equipe'))).toBe('/equipe');
		expect(decide('/conta', as('equipe'))).toBeNull();
		expect(decide('/', as('admin'))).toBe('/painel');
		expect(decide('/pedidos', as('admin'))).toBe('/painel');
		expect(decide('/equipe', as('admin'))).toBeNull();
	});
	it('logado em /entrar ou /cadastrar vai para next seguro ou para a home do papel', () => {
		expect(decide('/entrar', as('cliente'), '/pedidos')).toBe('/pedidos');
		expect(decide('/cadastrar', as('cliente'))).toBe('/');
		expect(decide('/entrar', as('equipe'))).toBe('/equipe');
		expect(decide('/entrar', as('admin'), 'https://evil.com')).toBe('/painel');
	});
});

describe('safeNext / parseRole / homeFor', () => {
	it('bloqueia open redirect', () => {
		expect(safeNext('/pedidos')).toBe('/pedidos');
		for (const n of ['//evil.com', 'https://evil.com', '/\\evil.com', '/entrar', '', null, undefined])
			expect(safeNext(n)).toBeNull();
	});
	it('papéis desconhecidos viram null', () => {
		expect(parseRole('admin')).toBe('admin');
		for (const r of ['root', '', undefined, 1]) expect(parseRole(r)).toBeNull();
		expect(homeFor('equipe')).toBe('/equipe');
	});
});
