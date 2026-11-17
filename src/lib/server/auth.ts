import { error } from '@sveltejs/kit';
import { adminAuth } from './firebase';

export type Role = 'cliente' | 'equipe' | 'admin';
export interface AuthUser {
	uid: string;
	role: Role | null; // null = conta ainda nao inicializada (/api/me/init)
	email?: string;
}

/** Unico ponto de autenticacao/autorizacao: todo endpoint /api passa por aqui. */
export async function authenticate(request: Request): Promise<AuthUser> {
	const header = request.headers.get('authorization') ?? '';
	const m = /^Bearer (.+)$/.exec(header);
	if (!m) throw error(401, 'missing token');
	try {
		const t = await adminAuth().verifyIdToken(m[1], true);
		const role = t.role === 'cliente' || t.role === 'equipe' || t.role === 'admin' ? t.role : null;
		return { uid: t.uid, role, email: t.email };
	} catch (e) {
		// Loga so a mensagem (nunca o token) para diagnosticar 401 sem expor nada ao cliente.
		console.error('verifyIdToken failed:', e instanceof Error ? e.message.slice(0, 300) : 'unknown');
		throw error(401, 'invalid token');
	}
}

/** Exige papel (ou um dos papeis). Conta sem papel so passa com allowUninitialized. */
export async function requireRole<R extends Role>(request: Request, ...roles: R[]): Promise<AuthUser & { role: R }> {
	const u = await authenticate(request);
	if (!u.role || !(roles as Role[]).includes(u.role)) throw error(403, 'forbidden');
	return u as AuthUser & { role: R };
}
