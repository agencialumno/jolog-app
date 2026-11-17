import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { api, signUp } from '../api';
import { firebaseAuth } from '../firebase-client';
import { parseRole, type Role } from './guard';

/** Estado de sessão do app. `ready` só vira true depois de resolver usuário + papel (custom claim). */
export const session = $state<{ ready: boolean; email: string | null; role: Role | null }>({
	ready: false,
	email: null,
	role: null
});

let registering = false;

async function resolve(user: User | null, force = false) {
	if (!user) {
		session.email = null;
		session.role = null;
		session.ready = true;
		return;
	}
	let role = parseRole((await user.getIdTokenResult(force)).claims.role);
	if (!role) {
		// Conta sem papel (ex.: cadastro interrompido): o servidor define "cliente"; nunca o app.
		try {
			await api('/api/me/init', { method: 'POST', body: '{}' });
			role = parseRole((await user.getIdTokenResult(true)).claims.role);
		} catch {
			/* continua sem papel: a guarda manda para /entrar */
		}
	}
	session.email = user.email;
	session.role = role;
	session.ready = true;
}

/** Chamar uma vez no cliente (onMount do layout). Devolve a função de cancelamento. */
export function startSession(): () => void {
	return onAuthStateChanged(firebaseAuth(), (u) => {
		if (registering) return; // o cadastro conclui a sessão sozinho (evita corrida com /api/me/init)
		void resolve(u).catch(() => {
			session.role = null;
			session.ready = true;
		});
	});
}

export async function login(email: string, password: string) {
	await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
	await resolve(firebaseAuth().currentUser, true);
}

export async function register(email: string, password: string, profile: { name: string; phone?: string }) {
	registering = true;
	try {
		await signUp(email.trim(), password, { name: profile.name.trim(), phone: profile.phone?.trim() || undefined });
	} finally {
		registering = false;
		await resolve(firebaseAuth().currentUser, true).catch(() => {});
	}
}

export async function logout() {
	await fbSignOut(firebaseAuth());
	await resolve(null);
}
