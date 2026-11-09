import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../../lib/server/auth';
import { adminAuth, adminDb } from '../../../../../../lib/server/firebase';
import { jsonBody } from '../../../../../../lib/server/http';
import type { RequestHandler } from './$types';

/** Somente admin define papeis de outras contas (nunca a propria, para nao perder o ultimo admin). */
export const POST: RequestHandler = async ({ request, params }) => {
	const admin = await requireRole(request, 'admin');
	const { role } = await jsonBody(request);
	if (role !== 'cliente' && role !== 'equipe' && role !== 'admin') throw error(400, 'invalid role');
	if (params.uid === admin.uid) throw error(400, 'cannot change own role');
	await adminAuth().setCustomUserClaims(params.uid, { role });
	await adminDb().collection('profiles').doc(params.uid).set({ role }, { merge: true });
	await adminAuth().revokeRefreshTokens(params.uid); // forca renovar o token com o novo papel
	return json({ ok: true });
};
