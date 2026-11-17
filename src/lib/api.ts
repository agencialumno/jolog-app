import { Capacitor } from '@capacitor/core';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from './firebase-client';
const env = import.meta.env;

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

/** Aguarda o Firebase restaurar o usuario da persistencia local (IndexedDB) se ainda nao estiver pronto. */
export async function getAuthUser(): Promise<User | null> {
	const auth = firebaseAuth();
	if (auth.currentUser) return auth.currentUser;
	return new Promise((resolve) => {
		const unsubscribe = onAuthStateChanged(auth, (u) => {
			unsubscribe();
			resolve(u);
		});
	});
}

/** Toda chamada a API do Vercel leva o ID token do Firebase em Authorization: Bearer. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
	const user = await getAuthUser();
	if (!user) throw new ApiError(401, 'not signed in');
	let token = await user.getIdToken();
	const makeHeaders = (t: string) => {
		const h = new Headers(init.headers);
		h.set('Authorization', `Bearer ${t}`);
		if (typeof init.body === 'string') h.set('Content-Type', 'application/json');
		return h;
	};
	// No browser (web/localhost), chamadas relativas sao seguras e evitam problemas de porta/CORS. No app nativo (Capacitor), usa PUBLIC_API_BASE_URL.
	const baseUrl = Capacitor.isNativePlatform() ? (env.PUBLIC_API_BASE_URL ?? '') : '';
	let res = await fetch(baseUrl + path, { ...init, headers: makeHeaders(token) });
	if (res.status === 403) {
		token = await user.getIdToken(true);
		res = await fetch(baseUrl + path, { ...init, headers: makeHeaders(token) });
	}
	if (!res.ok) {
		const text = await res.text();
		console.error(`API ${path} failed (${res.status}):`, text);
		throw new ApiError(res.status, text);
	}
	return res.headers.get('content-type')?.includes('json') ? ((await res.json()) as T) : (undefined as T);
}

/** Cadastro: cria a conta (e-mail/senha) e pede ao servidor o papel "cliente"; depois renova o token. */
export async function signUp(
	email: string,
	password: string,
	profile: { name: string; phone?: string; cpfCnpj?: string }
) {
	const { createUserWithEmailAndPassword } = await import('firebase/auth');
	const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
	await api('/api/me/init', { method: 'POST', body: JSON.stringify(profile) });
	await cred.user.getIdToken(true); // passa a carregar o claim role
}

/** Baixa uma foto pelo endpoint autenticado (nunca ha URL publica) e devolve uma object URL local. */
export async function photoObjectUrl(bookingId: string, photoId: string): Promise<string> {
	const user = firebaseAuth().currentUser;
	if (!user) throw new ApiError(401, 'not signed in');
	const res = await fetch(`${env.PUBLIC_API_BASE_URL ?? ''}/api/bookings/${bookingId}/photos/${photoId}`, {
		headers: { Authorization: `Bearer ${await user.getIdToken()}` }
	});
	if (!res.ok) throw new ApiError(res.status, 'photo unavailable');
	return URL.createObjectURL(await res.blob());
}
