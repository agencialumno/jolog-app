import { sveltekit } from '@sveltejs/kit/vite';
import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	// No ambiente de desenvolvimento local (vite dev), carrega segredos do .env no process.env do Node/Bun
	const env = loadEnv(mode, process.cwd(), '');
	for (const [k, v] of Object.entries(env)) {
		if (process.env[k] === undefined) process.env[k] = v;
	}

	// BUILD_TARGET=mobile -> SPA estatica para o Capacitor; BUILD_TARGET=web (padrao) -> API + painel no Vercel
	const mobile = process.env.BUILD_TARGET === 'mobile';

	return {
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
	};
});
