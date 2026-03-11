<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';

	$effect(() => {
		const code = $page.url.searchParams.get('code');
		if (code) {
			supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
				if (error) console.error('OAuth callback error:', error.message);
				void goto('/');
			});
		} else {
			void goto('/');
		}
	});
</script>

<p class="flex h-screen items-center justify-center text-sm text-neutral-400">Signing in...</p>
