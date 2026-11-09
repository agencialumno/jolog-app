import { json } from '@sveltejs/kit';
import { requireRole } from '../../../lib/server/auth';
import { adminDb } from '../../../lib/server/firebase';
import type { RequestHandler } from './$types';

/** Catalogo de itens de vistoria (ativos), para o cliente montar o checklist. */
export const GET: RequestHandler = async ({ request }) => {
	await requireRole(request, 'cliente', 'equipe', 'admin');
	const snaps = await adminDb()
		.collection('inspectionChecklistItems')
		.where('active', '==', true)
		.orderBy('position')
		.get();
	return json(snaps.docs.map((d) => ({ id: d.id, label: d.get('label') as string })));
};
