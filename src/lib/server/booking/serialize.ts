import { effectiveStatus, type BookingDoc } from './service';

export function serialize(b: BookingDoc) {
	return {
		customerId: b.customerId,
		propertyId: b.propertyId,
		serviceType: b.serviceType,
		status: effectiveStatus(b),
		startsAt: b.startsAt?.toDate().toISOString() ?? null,
		endsAt: b.endsAt?.toDate().toISOString() ?? null,
		priceCents: b.priceCents,
		assignedStaff: b.assignedStaff,
		holdExpiresAt: b.status === 'pending_payment' ? (b.holdExpiresAt?.toDate().toISOString() ?? null) : null,
		refundPercent: b.refundPercent,
		notes: b.notes,
		laundry: b.laundry ?? null,
		inspection: b.inspection ?? null
	};
}
