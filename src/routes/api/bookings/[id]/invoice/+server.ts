import { error, json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { invoiceProvider } from '../../../../../lib/server/deps';
import { canViewBooking } from '../../../../../lib/server/booking/access';
import type { BookingDoc } from '../../../../../lib/server/booking/service';
import type { RequestHandler } from './$types';

/**
 * Download da NF. Nao armazenamos o PDF: guardamos externalId (+ pdfUrl) do provedor e buscamos sob demanda.
 * Sem PDF ainda (processando) responde 202 com o status.
 */
export const GET: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'admin');
	const db = adminDb();
	const bSnap = await db.collection('bookings').doc(params.id).get();
	if (!bSnap.exists || !canViewBooking(u, bSnap.data() as BookingDoc)) throw error(404, 'not found');
	const inv = await db.collection('invoices').doc(params.id).get();
	if (!inv.exists || !inv.get('externalId')) throw error(404, 'invoice not found');

	let pdfUrl: string | undefined = inv.get('pdfUrl');
	let status: string = inv.get('status');
	if (!pdfUrl) {
		const fresh = await invoiceProvider().get(inv.get('externalId'));
		status = fresh.status;
		pdfUrl = fresh.pdfUrl;
		await inv.ref.set(
			{ status, ...(fresh.pdfUrl ? { pdfUrl: fresh.pdfUrl } : {}), ...(fresh.number ? { number: fresh.number } : {}) },
			{ merge: true }
		);
	}
	if (!pdfUrl) return json({ status }, { status: 202 });
	const upstream = await fetch(pdfUrl);
	if (!upstream.ok || !upstream.body) throw error(502, 'invoice provider unavailable');
	return new Response(upstream.body, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': 'attachment; filename="nota-fiscal.pdf"',
			'Cache-Control': 'private, no-store'
		}
	});
};
