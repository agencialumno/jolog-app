import { error, json } from '@sveltejs/kit';
import { Timestamp } from 'firebase-admin/firestore';
import { requireRole } from '../../../lib/server/auth';
import { adminDb } from '../../../lib/server/firebase';
import { jsonBody } from '../../../lib/server/http';
import type { RequestHandler } from './$types';

/** GET /api/properties — lista os imóveis do cliente */
export const GET: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente', 'admin');
	const col = adminDb().collection('properties');
	const q = u.role === 'admin' ? col : col.where('ownerId', '==', u.uid);
	const snaps = await q.get();
	return json(
		snaps.docs.map((d) => ({
			id: d.id,
			address: d.get('address') as string,
			condominium: (d.get('condominium') as string) ?? null,
			bedrooms: d.get('bedrooms') as 2 | 3
		}))
	);
};

/** POST /api/properties — cadastra um novo imóvel */
export const POST: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente');
	const body = await jsonBody(request);
	const address = typeof body.address === 'string' ? body.address.trim() : '';
	const condominium = typeof body.condominium === 'string' ? body.condominium.trim() : null;
	const bedrooms = Number(body.bedrooms);

	if (!address || (bedrooms !== 2 && bedrooms !== 3)) {
		throw error(400, 'invalid property data');
	}

	const ref = await adminDb()
		.collection('properties')
		.add({
			ownerId: u.uid,
			address,
			condominium: condominium || null,
			bedrooms,
			createdAt: Timestamp.now()
		});

	return json({ id: ref.id }, { status: 201 });
};
