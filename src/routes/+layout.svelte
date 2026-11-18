<script lang="ts">
	import '@fontsource/montserrat/400.css';
	import '@fontsource/montserrat/500.css';
	import '@fontsource/montserrat/600.css';
	import '@fontsource/montserrat/700.css';
	import '@fontsource/montserrat/800.css';
	import '../lib/styles/tokens.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { decide } from '../lib/auth/guard';
	import { session, startSession } from '../lib/auth/session.svelte';
	import BottomNav from '../lib/components/BottomNav.svelte';
	let { children } = $props();

	onMount(() => startSession());

	// Guarda de rota: sem login -> /entrar; cada papel vai para a sua área.
	const redirect = $derived(
		decide(page.url.pathname, { ready: session.ready, role: session.role }, page.url.searchParams.get('next'))
	);
	$effect(() => {
		if (redirect) void goto(redirect, { replaceState: true });
	});
	const showNav = $derived(
		session.ready &&
			(session.role === 'cliente' || session.role === 'equipe') &&
			!redirect &&
			!/^\/(entrar|cadastrar|limpeza|vistoria|lavanderia|completar-cadastro)/.test(page.url.pathname)
	);
</script>

<div class="safe">
	<div class="card">
		<div class="brand">
			<img src="/logo.png" alt="Grupo Jolog" />
		</div>
		{#if session.ready && !redirect}
			{@render children()}
		{:else}
			<p class="loading" role="status">Carregando…</p>
		{/if}
	</div>
	{#if session.ready && !redirect && showNav}<BottomNav />{/if}
</div>

<style>
	.safe {
		min-height: 100vh;
		padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
		max-width: 560px;
		margin: 0 auto;
	}
	.brand {
		display: flex;
		justify-content: center;
		padding: 4px 0 20px;
	}
	.brand img {
		height: 76px;
		width: auto;
		max-width: 85%;
		object-fit: contain;
	}
	.card {
		background: var(--color-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: 28px 22px;
		margin-bottom: 96px;
		min-height: 50vh;
	}
	.loading {
		text-align: center;
		margin-top: 20vh;
		color: var(--color-muted);
	}
</style>
