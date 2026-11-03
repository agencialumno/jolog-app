import { sveltekit } from '@sveltejs/kit/vite';
import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vitest/config';

// BUILD_TARGET=mobile -> SPA estatica para o Capacitor; BUILD_TARGET=web (padrao) -> API + painel no Vercel
const mobile = process.env.BUILD_TARGET === 'mobile';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: mobile ? adapterStatic({ pages: 'build', assets: 'build', fallback: 'index.html' }) : adapterVercel()
		})
	],
	test: { include: ['src/**/*.test.ts'] }
});
