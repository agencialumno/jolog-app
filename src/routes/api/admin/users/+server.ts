import { json } from '@sveltejs/kit';
import { requireRole } from '../../../../lib/server/auth';
import { adminDb } from '../../../../lib/server/firebase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	await requireRole(request, 'admin');
	const col = adminDb().collection('profiles');
	const snaps = await col.get();

	const list = snaps.docs.map((d) => ({
		uid: d.id,
		name: (d.get('name') as string) || 'Sem nome',
		phone: (d.get('phone') as string | null) ?? null,
		role: (d.get('role') as string) || 'cliente',
		createdAt: d.get('createdAt')?.toDate?.()?.toISOString?.() ?? null
	}));

	return json(list);
};
