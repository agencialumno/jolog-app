export type Role = 'cliente' | 'equipe' | 'admin';
export interface GuardState {
	ready: boolean;
	/** null = sem sessao (ou conta ainda sem papel). */
	role: Role | null;
}

export const parseRole = (v: unknown): Role | null => (v === 'cliente' || v === 'equipe' || v === 'admin' ? v : null);

export const homeFor = (role: Role): string => (role === 'admin' ? '/painel' : role === 'equipe' ? '/equipe' : '/');

const AUTH_PAGES = ['/entrar', '/cadastrar'];
const CLIENT_ONLY = ['/limpeza', '/lavanderia', '/vistoria', '/pedidos', '/pedido', '/completar-cadastro'];
const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';
const under = (path: string, bases: string[]) => bases.some((b) => path === b || path.startsWith(b + '/'));

/** Aceita so caminhos internos (evita open redirect via ?next=). */
export function safeNext(next: string | null | undefined): string | null {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
	return AUTH_PAGES.some((p) => next.startsWith(p)) ? null : next;
}

/**
 * Guarda de rota unica (so UX; a seguranca real e o servidor/firestore.rules).
 * Devolve o destino do redirecionamento, ou null se a pagina pode ser exibida.
 */
export function decide(rawPath: string, s: GuardState, next?: string | null): string | null {
	if (!s.ready) return null;
	const path = norm(rawPath);
	const { role } = s;
	const isAuthPage = under(path, AUTH_PAGES);
	const isClientOnly = under(path, CLIENT_ONLY);
	const isAccount = path === '/conta';
	const isHome = path === '/';

	if (!role) {
		if (isAuthPage) return null;
		if (isHome) return '/entrar';
		if (isClientOnly || isAccount || path.startsWith('/equipe') || path.startsWith('/painel'))
			return `/entrar?next=${encodeURIComponent(path)}`;
		return null;
	}
	if (isAuthPage) return safeNext(next) ?? homeFor(role);
	if (role === 'cliente') return path.startsWith('/equipe') || path.startsWith('/painel') ? '/' : null;
	if (role === 'equipe') return isHome || isClientOnly || path.startsWith('/painel') ? '/equipe' : null;
	// admin: acessa /painel e /equipe
	return isHome || isClientOnly ? '/painel' : null;
}
