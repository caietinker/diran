<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Button from '$lib/components/ui/button/index.svelte';
	import { goto } from '$app/navigation';

	async function handleSignOut() {
		await auth.signOut();
		void goto('/auth');
	}
</script>

<main class="mx-auto max-w-md p-4">
	<h1 class="mb-6 text-2xl font-semibold">Profile</h1>

	<div class="rounded-lg border border-neutral-100 bg-white p-6">
		<div class="flex flex-col items-center">
			{#if auth.user?.user_metadata?.avatar_url}
				<img
					src={auth.user.user_metadata.avatar_url}
					alt="Avatar"
					class="mb-4 h-20 w-20 rounded-full object-cover"
				/>
			{:else}
				<div class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200">
					<svg class="h-10 w-10 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
						<path
							d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
				</div>
			{/if}

			<h2 class="text-lg font-medium">
				{auth.user?.user_metadata?.name || auth.user?.email || 'User'}
			</h2>
			<p class="text-neutral-500">{auth.user?.email}</p>
		</div>
	</div>

	<Button variant="outline" onclick={handleSignOut} class="mt-6 w-full">Sign out</Button>
</main>
