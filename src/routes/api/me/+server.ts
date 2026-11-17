import { json } from '@sveltejs/kit';
import { requireRole } from '../../../lib/server/auth';
import { adminDb } from '../../../lib/server/firebase';
import type { RequestHandler } from './$types';

/** Dados do próprio usuário (o app só fala com a API e com o Firebase Auth). */
export const GET: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	const p = await adminDb().collection('profiles').doc(u.uid).get();
	return json({
		uid: u.uid,
		role: u.role,
		email: u.email ?? null,
		name: (p.get('name') as string | undefined) ?? '',
		phone: (p.get('phone') as string | null | undefined) ?? null
	});
};
