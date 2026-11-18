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

	const isWidePage = $derived(page.url.pathname.startsWith('/painel'));
	const isAuthPage = $derived(page.url.pathname === '/entrar' || page.url.pathname === '/cadastrar');
</script>

<div class="safe" class:wide={isWidePage} class:auth-page={isAuthPage}>
	<div class="card" class:wide-card={isWidePage} class:auth-card={isAuthPage}>
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
		box-sizing: border-box;
		transition: max-width 0.2s ease;
	}

	/* Página larga (Painel Admin) no desktop/tablet */
	.safe.wide {
		max-width: 1180px;
	}

	/* Centralização vertical e horizontal no Login/Cadastro na versão Web */
	.safe.auth-page {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
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
		width: 100%;
		box-sizing: border-box;
	}

	/* Card expandido para o painel de controle */
	.card.wide-card {
		padding: 32px 32px;
		margin-bottom: 40px;
	}

	/* Card centralizado na autenticação */
	.card.auth-card {
		max-width: 440px;
		margin-bottom: 0;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
	}

	.loading {
		text-align: center;
		margin-top: 20vh;
		color: var(--color-muted);
	}

	@media (max-width: 768px) {
		.safe.wide {
			max-width: 100%;
			padding: calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 80px);
		}
		.card.wide-card {
			padding: 20px 14px;
			margin-bottom: 80px;
		}
		.safe.auth-page {
			display: block;
		}
		.card.auth-card {
			max-width: 100%;
			margin-bottom: 96px;
		}
	}
</style>
