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

<div class="safe" class:wide={isWidePage} class:auth-page={isAuthPage} class:has-nav={showNav}>
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
	/*
	 * A pagina ocupa exatamente a altura da tela (100dvh). O card cresce para preencher o espaco restante,
	 * entao so ha rolagem quando o conteudo realmente nao cabe.
	 */
	.safe {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
		max-width: 560px;
		margin: 0 auto;
		box-sizing: border-box;
	}

	/* Reserva espaco para a barra inferior flutuante (so quando ela existe). */
	.safe.has-nav {
		padding-bottom: calc(env(safe-area-inset-bottom) + 92px);
	}

	/* Painel admin: largo no desktop */
	.safe.wide {
		max-width: 1180px;
	}

	/* Login/cadastro: card centralizado na tela (web) */
	.safe.auth-page {
		justify-content: center;
		align-items: center;
	}

	.brand {
		display: flex;
		justify-content: center;
		padding: 0 0 16px;
	}
	.brand img {
		height: 76px;
		width: auto;
		max-width: 85%;
		object-fit: contain;
	}
	.card {
		flex: 1 1 auto;
		background: var(--color-bg);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow);
		padding: 24px 22px;
		width: 100%;
		box-sizing: border-box;
	}
	.card.wide-card {
		padding: 28px 32px;
	}
	.card.auth-card {
		flex: 0 1 auto;
		max-width: 440px;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
	}

	.loading {
		text-align: center;
		margin: 20vh 0 0;
		color: var(--color-muted);
	}

	@media (max-width: 768px) {
		.safe.wide {
			max-width: 100%;
			padding: calc(env(safe-area-inset-top) + 10px) 10px calc(env(safe-area-inset-bottom) + 74px);
		}
		.card.wide-card {
			padding: 14px 14px 16px;
			border-radius: 18px;
		}
		.safe.wide .brand {
			padding-bottom: 8px;
		}
		.safe.wide .brand img {
			height: 44px;
		}
		/* Login/cadastro no celular: card ocupa a tela, sem centralizar */
		.safe.auth-page {
			justify-content: flex-start;
			align-items: stretch;
		}
		.card.auth-card {
			flex: 1 1 auto;
			max-width: 100%;
		}
	}
</style>
