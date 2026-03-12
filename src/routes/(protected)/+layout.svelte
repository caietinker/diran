<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/ui/avatar/index.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { children } = $props();

	$effect(() => {
		if (auth.ready && !auth.user) void goto('/auth');
	});

	const links = [
		{ href: '/', label: 'Today' },
		{ href: '/categories', label: 'Categories' }
	];
</script>

{#if auth.ready && auth.user}
	<nav class="flex h-14 items-center gap-6 border-b border-border px-4">
		<a href="/" class="text-lg font-semibold tracking-tight text-foreground">Diran</a>

		<div class="flex items-center gap-1">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {page.url.pathname ===
					link.href
						? 'bg-accent text-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{link.label}
				</a>
			{/each}
		</div>

		<div class="ml-auto">
			<Avatar src={auth.user.user_metadata?.avatar_url} />
		</div>
	</nav>
	<div class="min-h-[calc(100vh-3.5rem)]">
		{@render children()}
	</div>
{/if}
