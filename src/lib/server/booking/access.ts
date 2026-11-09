import type { Role } from '../auth';

export interface Actor {
	uid: string;
	role: Role;
}

/** Quem ve um pedido (e suas fotos): dono, equipe atribuida, admin. */
export function canViewBooking(actor: Actor, b: { customerId: string; assignedStaff: string | null }): boolean {
	if (actor.role === 'admin') return true;
	if (actor.role === 'cliente') return b.customerId === actor.uid;
	return b.assignedStaff === actor.uid;
}

/** Quem envia fotos: equipe atribuida ou admin. */
export function canUploadPhoto(actor: Actor, b: { assignedStaff: string | null }): boolean {
	return actor.role === 'admin' || (actor.role === 'equipe' && b.assignedStaff === actor.uid);
}
