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
			block: (d.get('block') as string) ?? null,
			apartment: (d.get('apartment') as string) ?? null,
			street: (d.get('street') as string) ?? null,
			number: (d.get('number') as string) ?? null,
			cep: (d.get('cep') as string) ?? null,
			bedrooms: d.get('bedrooms') as 2 | 3
		}))
	);
};

/** POST /api/properties — cadastra ou atualiza o imóvel do cliente */
export const POST: RequestHandler = async ({ request }) => {
	const u = await requireRole(request, 'cliente');
	const body = await jsonBody(request);

	const condominium = typeof body.condominium === 'string' ? body.condominium.trim() : null;
	const block = typeof body.block === 'string' ? body.block.trim() : null;
	const apartment = typeof body.apartment === 'string' ? body.apartment.trim() : null;
	const street = typeof body.street === 'string' ? body.street.trim() : '';
	const number = typeof body.number === 'string' ? body.number.trim() : '';
	const cep = typeof body.cep === 'string' ? body.cep.trim() : null;
	const bedrooms = Number(body.bedrooms);

	const unitDetails = [block && `Bloco ${block}`, apartment && `Apto ${apartment}`].filter(Boolean).join(' - ');
	const composedAddress = [
		street && number ? `${street}, nº ${number}` : street || number,
		unitDetails,
		condominium && `Condomínio ${condominium}`
	]
		.filter(Boolean)
		.join(' · ');

	const address = (typeof body.address === 'string' && body.address.trim()) || composedAddress;

	if (!address || (bedrooms !== 2 && bedrooms !== 3)) {
		throw error(400, 'invalid property data');
	}

	const ref = await adminDb()
		.collection('properties')
		.add({
			ownerId: u.uid,
			address,
			condominium: condominium || null,
			block: block || null,
			apartment: apartment || null,
			street: street || null,
			number: number || null,
			cep: cep || null,
			bedrooms,
			createdAt: Timestamp.now()
		});

	return json({ id: ref.id }, { status: 201 });
};
