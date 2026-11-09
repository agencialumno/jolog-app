import { requireRole } from '../../../../../../lib/server/auth';
import { adminDb } from '../../../../../../lib/server/firebase';
import { fileStorage } from '../../../../../../lib/server/deps';
import { guard } from '../../../../../../lib/server/http';
import { openPhoto } from '../../../../../../lib/server/booking/photos';
import type { RequestHandler } from './$types';

/** Entrega a foto autenticada (Authorization: Bearer). O app nunca recebe URL publica do blob. */
export const GET: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	const f = await guard(() =>
		openPhoto(adminDb(), fileStorage(), { bookingId: params.id, photoId: params.photoId, actor: u })
	);
	return new Response(f.stream, {
		headers: {
			'Content-Type': f.contentType,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store'
		}
	});
};
