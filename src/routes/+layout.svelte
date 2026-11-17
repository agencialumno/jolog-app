<script lang="ts">
	import '@fontsource/barlow-condensed/600.css';
	import '@fontsource/barlow-condensed/700.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/600.css';
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
		session.ready && session.role === 'cliente' && !redirect && !/^\/(entrar|cadastrar)/.test(page.url.pathname)
	);
</script>

<div class="safe">
	{#if session.ready && !redirect}
		{@render children()}
		{#if showNav}<BottomNav />{/if}
	{:else}
		<p class="loading" role="status">Carregando…</p>
	{/if}
</div>

<style>
	.loading {
		text-align: center;
		margin-top: 40vh;
		color: var(--color-secondary);
	}
</style>
