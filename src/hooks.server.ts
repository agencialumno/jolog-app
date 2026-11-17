import type { Handle } from '@sveltejs/kit/hooks';
import { allowedOrigin, corsHeaders } from './lib/server/cors';

/** Libera CORS só para o app (o ID token vai em Authorization, então não há cookies/credentials). */
export const handle: Handle = async ({ event, resolve }) => {
	if (!event.url.pathname.startsWith('/api/')) return resolve(event);
	const origin = allowedOrigin(event.request.headers.get('origin'));
	if (event.request.method === 'OPTIONS')
		return new Response(null, { status: origin ? 204 : 403, headers: origin ? corsHeaders(origin) : {} });
	const res = await resolve(event);
	if (origin) for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
	return res;
};
