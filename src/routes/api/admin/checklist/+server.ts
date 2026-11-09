import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../lib/server/auth';
import { adminDb } from '../../../../lib/server/firebase';
import { jsonBody } from '../../../../lib/server/http';
import type { RequestHandler } from './$types';

/** Admin cria/edita item do catalogo. Corpo: { id?, label, active?, position? } */
export const POST: RequestHandler = async ({ request }) => {
	await requireRole(request, 'admin');
	const b = await jsonBody(request);
	if (typeof b.label !== 'string' || !b.label.trim()) throw error(400, 'invalid label');
	const col = adminDb().collection('inspectionChecklistItems');
	const ref = typeof b.id === 'string' && b.id ? col.doc(b.id) : col.doc();
	await ref.set(
		{
			label: b.label.trim().slice(0, 120),
			active: b.active !== false,
			position: Number.isInteger(b.position) ? b.position : 0
		},
		{ merge: true }
	);
	return json({ id: ref.id }, { status: 201 });
};
