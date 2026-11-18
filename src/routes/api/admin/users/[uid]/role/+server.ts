import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../../lib/server/auth';
import { adminAuth, adminDb } from '../../../../../../lib/server/firebase';
import { jsonBody } from '../../../../../../lib/server/http';
import type { RequestHandler } from './$types';

/**
 * Define ou altera o papel (role) de um usuário.
 * O parâmetro [uid] pode ser tanto o UID do Firebase quanto o e-mail da conta.
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const admin = await requireRole(request, 'admin');
	const { role } = await jsonBody(request);
	if (role !== 'cliente' && role !== 'equipe' && role !== 'admin') {
		throw error(400, 'Papel inválido. Deve ser cliente, equipe ou admin.');
	}

	const auth = adminAuth();
	const db = adminDb();
	const rawIdentifier = decodeURIComponent(params.uid).trim();

	let targetUid = rawIdentifier;
	let userRecord;

	// Se for informado um e-mail (contém @), resolve o UID pelo Firebase Auth
	if (rawIdentifier.includes('@')) {
		userRecord = await auth.getUserByEmail(rawIdentifier).catch(() => null);
		if (!userRecord) {
			throw error(404, `Nenhuma conta foi encontrada com o e-mail "${rawIdentifier}".`);
		}
		targetUid = userRecord.uid;
	} else {
		userRecord = await auth.getUser(rawIdentifier).catch(() => null);
		if (!userRecord) {
			throw error(404, `Nenhum usuário foi encontrado com o UID "${rawIdentifier}".`);
		}
	}

	if (targetUid === admin.uid) {
		throw error(400, 'Não é permitido alterar o próprio papel de administrador.');
	}

	// 1. Atualiza os Custom User Claims no Firebase Authentication
	await auth.setCustomUserClaims(targetUid, { role });

	// 2. Atualiza ou cria o documento correspondente em "profiles" no Firestore
	await db
		.collection('profiles')
		.doc(targetUid)
		.set(
			{
				role,
				email: userRecord.email ?? null,
				name: userRecord.displayName || (userRecord.email ? userRecord.email.split('@')[0] : 'Usuário')
			},
			{ merge: true }
		);

	// 3. Revoga os tokens de refresh para forçar o cliente a renovar o claim de papel
	await auth.revokeRefreshTokens(targetUid).catch(() => {});

	return json({ ok: true, uid: targetUid, role, email: userRecord.email });
};
