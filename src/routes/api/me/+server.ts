import { json } from '@sveltejs/kit';
import { requireRole } from '../../../lib/server/auth';
import { adminAuth, adminDb } from '../../../lib/server/firebase';
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

/** Exclusão da conta pelo próprio usuário (exigência da Apple App Store Guideline 5.1.1(v) e LGPD). */
export const DELETE: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente');
	const db = adminDb();
	const auth = adminAuth();

	// 1. Remove perfil do Firestore
	await db.collection('profiles').doc(u.uid).delete();

	// 2. Remove propriedades cadastradas pelo cliente
	const propSnaps = await db.collection('properties').where('customerId', '==', u.uid).get();
	if (!propSnaps.empty) {
		const batch = db.batch();
		for (const doc of propSnaps.docs) {
			batch.delete(doc.ref);
		}
		await batch.commit();
	}

	// 3. Exclui a conta no Firebase Authentication
	await auth.deleteUser(u.uid);

	return json({ ok: true });
};
