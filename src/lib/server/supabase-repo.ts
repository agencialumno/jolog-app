import { createClient } from '@supabase/supabase-js';
const env = process.env;
import type { BookingRepo } from './payment-handler';

/** Repositorio com service role (so no servidor). Depende de supabase/migrations/0001_init.sql. */
export function supabaseRepo(): BookingRepo {
	const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
	const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
		if (r.error || r.data === null) throw new Error(r.error?.message ?? 'not found');
		return r.data;
	};
	return {
		async registerEvent(eventId) {
			const { error } = await db.from('payment_events').insert({ event_id: eventId });
			if (error?.code === '23505') return false;
			if (error) throw new Error(error.message);
			return true;
		},
		async markPaid(bookingId, providerId) {
			await db
				.from('payments')
				.update({ status: 'paid', paid_at: new Date().toISOString() })
				.eq('provider_id', providerId);
			const b = must<{ service_type: string; price_cents: number; starts_at: string | null; created_at: string }>(
				await db
					.from('bookings')
					.update({ status: 'scheduled' })
					.eq('id', bookingId)
					.select('service_type, price_cents, starts_at, created_at')
					.single()
			);
			const service = b.service_type as 'cleaning' | 'laundry' | 'inspection';
			if (service === 'laundry') await db.from('bookings').update({ status: 'awaiting_contact' }).eq('id', bookingId);
			const names = {
				cleaning: 'Servico de limpeza',
				laundry: 'Servico de lavanderia',
				inspection: 'Vistoria de check-in'
			};
			return {
				service,
				valueCents: b.price_cents,
				description: names[service],
				serviceDate: String(b.starts_at ?? b.created_at).slice(0, 10)
			};
		},
		async markExpired(id) {
			await db.from('bookings').update({ status: 'canceled' }).eq('id', id).eq('status', 'pending_payment');
		},
		async markRefunded(id) {
			await db.from('bookings').update({ status: 'refunded' }).eq('id', id);
		},
		async saveInvoice(id, externalId, status) {
			await db
				.from('invoices')
				.upsert({ booking_id: id, external_id: externalId, status }, { onConflict: 'booking_id' });
		},
		async recordInvoiceFailure(id, error) {
			await db.from('invoices').upsert({ booking_id: id, status: 'error', error }, { onConflict: 'booking_id' });
		}
	};
}
