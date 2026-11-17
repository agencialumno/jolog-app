import { sveltekit } from '@sveltejs/kit/vite';
import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vitest/config';

// BUILD_TARGET=mobile -> SPA estatica para o Capacitor; BUILD_TARGET=web (padrao) -> API + painel no Vercel
const mobile = process.env.BUILD_TARGET === 'mobile';

export default defineConfig({
	// Endpoints so-web (ex.: /api/diagnostics) respondem 404 no build mobile.
	define: { __WEB_BUILD__: JSON.stringify(!mobile) },
	// Variaveis publicas (PUBLIC_*) chegam ao app via import.meta.env; segredos nunca usam este prefixo.
	envPrefix: ['VITE_', 'PUBLIC_'],
	plugins: [
		sveltekit({
			adapter: mobile ? adapterStatic({ pages: 'build', assets: 'build', fallback: 'index.html' }) : adapterVercel()
		})
	],
	test: {
		include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
		fileParallelism: false,
		testTimeout: 20000,
		env: { FIREBASE_PROJECT_ID: 'demo-jolog' }
	}
});
