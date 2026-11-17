/** CORS do /api para o app Capacitor (origens capacitor://localhost, http(s)://localhost) e extras em CORS_ORIGINS. */
const DEFAULTS = ['capacitor://localhost', 'http://localhost', 'https://localhost'];

export function allowedOrigin(origin: string | null, extra = process.env.CORS_ORIGINS): string | null {
	if (!origin) return null;
	const list = [...DEFAULTS, ...(extra ?? '').split(',').map((s) => s.trim())].filter(Boolean);
	return list.includes(origin) ? origin : null;
}

export function corsHeaders(origin: string): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type',
		'Access-Control-Max-Age': '600',
		Vary: 'Origin'
	};
}
