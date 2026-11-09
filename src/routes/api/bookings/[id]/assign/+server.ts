import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminAuth, adminDb } from '../../../../../lib/server/firebase';
import { guard, jsonBody } from '../../../../../lib/server/http';
import { assignStaff } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	await requireRole(request, 'admin');
	const { staffUid } = await jsonBody(request);
	if (staffUid !== null) {
		if (typeof staffUid !== 'string') throw error(400, 'invalid staffUid');
		const target = await adminAuth()
			.getUser(staffUid)
			.catch(() => null);
		if (target?.customClaims?.role !== 'equipe') throw error(400, 'user is not equipe');
	}
	await guard(() => assignStaff(adminDb(), params.id, staffUid as string | null));
	return json({ ok: true });
};
