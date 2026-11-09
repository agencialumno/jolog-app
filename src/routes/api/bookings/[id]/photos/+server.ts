import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { fileStorage } from '../../../../../lib/server/deps';
import { guard } from '../../../../../lib/server/http';
import { listPhotos, MAX_PHOTO_BYTES, uploadPhoto } from '../../../../../lib/server/booking/photos';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'equipe', 'admin');
	return json(await guard(() => listPhotos(adminDb(), { bookingId: params.id, actor: u })));
};

/** multipart/form-data: kind=before|after, file=<imagem JPEG/PNG/WebP, ate 5 MB>. Equipe atribuida ou admin. */
export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'equipe', 'admin');
	const len = Number(request.headers.get('content-length') ?? 0);
	if (len > MAX_PHOTO_BYTES + 64 * 1024) throw error(413, 'too large');
	const form = await request.formData().catch(() => null);
	const file = form?.get('file');
	if (!form || !(file instanceof File)) throw error(400, 'file required');
	const r = await guard(async () =>
		uploadPhoto(adminDb(), fileStorage(), {
			bookingId: params.id,
			kind: String(form.get('kind')),
			bytes: new Uint8Array(await file.arrayBuffer()),
			declaredType: file.type,
			actor: u
		})
	);
	return json(r, { status: 201 });
};
