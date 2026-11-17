<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/', label: 'Início', icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
		{
			href: '/pedidos',
			label: 'Pedidos',
			icon: 'M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm2 5h8m-8 4h8'
		},
		{
			href: '/conta',
			label: 'Conta',
			icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0'
		}
	];
	const active = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<nav aria-label="Navegação principal" class="bottom-nav">
	{#each items as it}
		<a href={it.href} aria-current={active(it.href) ? 'page' : undefined} class:on={active(it.href)}>
			<svg
				viewBox="0 0 24 24"
				width="24"
				height="24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d={it.icon} stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			<span>{it.label}</span>
		</a>
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 10;
	}
	a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 56px;
		color: var(--color-secondary);
		text-decoration: none;
		font: 600 12px var(--font-body);
	}
	a.on {
		color: var(--color-primary);
	}
</style>
