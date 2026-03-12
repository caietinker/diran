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

	// ─── Live clock ───────────────────────────────────────────────────────────
	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const clockTime = $derived(
		now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
	);
	const clockDate = $derived(
		now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(' ', '\u00a0')
	);

	// ─── Dark mode ────────────────────────────────────────────────────────────
	let dark = $state(false);

	$effect(() => {
		// Read persisted preference on first render; fall back to OS preference
		const stored = localStorage.getItem('theme');
		if (stored === 'dark') {
			dark = true;
		} else if (stored === 'light') {
			dark = false;
		} else {
			dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		}
	});

	$effect(() => {
		if (dark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	});
</script>

{#if auth.ready && auth.user}
	<nav class="flex h-14 items-center gap-4 border-b border-border px-4">
		<a href="/" class="shrink-0 text-sm font-semibold tracking-tight text-foreground">Diran</a>

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

		<div class="ml-auto flex items-center gap-3">
			<!-- Live clock -->
			<span class="font-mono text-sm text-muted-foreground tabular-nums select-none">
				{clockTime}&nbsp;&nbsp;{clockDate}
			</span>

			<!-- Dark mode toggle -->
			<button
				onclick={() => (dark = !dark)}
				title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
				class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				{#if dark}
					<!-- Sun icon -->
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
						/>
					</svg>
				{:else}
					<!-- Moon icon -->
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				{/if}
			</button>

			<Avatar src={auth.user.user_metadata?.avatar_url} />
		</div>
	</nav>
	<div class="min-h-[calc(100vh-3.5rem)]">
		{@render children()}
	</div>
{/if}
