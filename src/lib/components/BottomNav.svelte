<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/', label: 'Início', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
		{
			href: '/pedidos',
			label: 'Pedidos',
			icon: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm2 5h8m-8 4h8'
		},
		{ href: '/conta', label: 'Conta', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0' }
	];
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<nav aria-label="Principal">
	{#each items as it (it.href)}
		<a href={it.href} class:on={active(it.href)} aria-current={active(it.href) ? 'page' : undefined}>
			<svg
				viewBox="0 0 24 24"
				width="22"
				height="22"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d={it.icon} /></svg
			>
			<span>{it.label}</span>
		</a>
	{/each}
</nav>

<style>
	nav {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(env(safe-area-inset-bottom) + 12px);
		width: min(360px, calc(100% - 32px));
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		padding: 6px;
		background: #fff;
		border-radius: 999px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
		z-index: 10;
	}
	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 52px;
		border-radius: 999px;
		color: var(--color-muted);
		text-decoration: none;
		font: 600 12px var(--font-body);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}
	a.on {
		color: #fff;
		background: var(--gradient-btn);
	}
</style>
