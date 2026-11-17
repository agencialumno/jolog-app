/** Link do SAC (só texto) via wa.me. number = PUBLIC_WHATSAPP_NUMBER; null se não configurado/inválido. */
export function whatsappUrl(number: string | undefined, text?: string): string | null {
	const digits = (number ?? '').replace(/\D/g, '');
	if (digits.length < 10) return null;
	return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const sacUrl = () =>
	whatsappUrl(import.meta.env.PUBLIC_WHATSAPP_NUMBER, 'Olá! Preciso de ajuda com o app da Jolog.');
