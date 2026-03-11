<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/components/ui/avatar/index.svelte';
	import { goto } from '$app/navigation';

	let { children } = $props();

	$effect(() => {
		if (auth.ready && !auth.user) void goto('/auth');
	});
</script>

{#if auth.ready && auth.user}
	<nav class="flex h-14 items-center justify-between border-b border-neutral-100 px-4">
		<a href="/" class="text-lg font-medium">Todo</a>
		<Avatar src={auth.user.user_metadata?.avatar_url} />
	</nav>
	{@render children()}
{/if}
