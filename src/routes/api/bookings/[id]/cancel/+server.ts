import { json } from '@sveltejs/kit';
import { requireRole } from '../../../../../lib/server/auth';
import { adminDb } from '../../../../../lib/server/firebase';
import { paymentProvider } from '../../../../../lib/server/deps';
import { guard } from '../../../../../lib/server/http';
import { cancelBooking } from '../../../../../lib/server/booking/service';
import { refundCents } from '../../../../../lib/cancellation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const u = await requireRole(request, 'cliente', 'admin');
	const db = adminDb();
	const { refundPercent } = await guard(() => cancelBooking(db, { bookingId: params.id, actor: u }));
	let refunded = false;
	if (refundPercent > 0) {
		const ref = db.collection('bookings').doc(params.id);
		const [b, pay] = await Promise.all([
			ref.get(),
			db.collection('payments').where('bookingId', '==', params.id).where('status', '==', 'paid').limit(1).get()
		]);
		if (!pay.empty) {
			try {
				await paymentProvider().refund({
					providerId: pay.docs[0].get('providerId'),
					valueCents: refundCents(b.get('priceCents'), refundPercent)
				});
				refunded = true;
			} catch {
				await ref.update({ needsRefund: true }); // admin finaliza o reembolso manualmente
			}
		}
	}
	return json({ refundPercent, refunded });
};
