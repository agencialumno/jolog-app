import { json } from '@sveltejs/kit';
import { Timestamp } from 'firebase-admin/firestore';
import { authenticate } from '../../../../lib/server/auth';
import { adminAuth, adminDb } from '../../../../lib/server/firebase';
import { jsonBody } from '../../../../lib/server/http';
import type { RequestHandler } from './$types';

/**
 * Primeiro acesso apos o cadastro (Firebase Auth e-mail/senha). Define SEMPRE o papel "cliente"
 * e cria o perfil. Qualquer "role" no corpo e ignorado: nao ha como se auto-promover.
 * Idempotente: se ja tem papel, devolve o existente sem alterar nada.
 */
export const POST: RequestHandler = async ({ request }) => {
	const user = await authenticate(request);
	if (user.role) return json({ role: user.role, created: false });
	const body = await jsonBody(request);
	const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
	await adminAuth().setCustomUserClaims(user.uid, { role: 'cliente' });
	await adminDb()
		.collection('profiles')
		.doc(user.uid)
		.create({
			role: 'cliente',
			name: str(body.name, 120) ?? '',
			phone: str(body.phone, 30),
			cpfCnpj: str(body.cpfCnpj, 20),
			createdAt: Timestamp.now()
		})
		.catch((e: { code?: number }) => {
			if (e.code !== 6) throw e; // perfil ja existe: ok
		});
	// O app deve renovar o ID token (getIdToken(true)) para enxergar o novo papel.
	return json({ role: 'cliente', created: true });
};
