import { error, json } from '@sveltejs/kit';
import { authenticate } from '../../../lib/server/auth';
import { checkBlobPrivate, checkFirestore, overall } from '../../../lib/server/diagnostics';
import type { RequestHandler } from './$types';

/**
 * TEMPORARIO. Repositorio publico: qualquer falha de acesso (sem token, token invalido, nao-admin,
 * build mobile) responde 404, para nao revelar que o endpoint existe. Remover apos o teste real.
 */
export const GET: RequestHandler = async ({ request }) => {
	if (!__WEB_BUILD__) throw error(404, 'Not found');
	let admin = false;
	try {
		admin = (await authenticate(request)).role === 'admin';
	} catch {
		/* qualquer erro de auth vira 404 */
	}
	if (!admin) throw error(404, 'Not found');
	const etapas = { firestore: await checkFirestore(), blob: await checkBlobPrivate() };
	return json({ ok: overall(etapas), etapas }, { headers: { 'cache-control': 'no-store' } });
};
