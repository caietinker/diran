import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

class Auth {
	user = $state<User | null>(null);
	ready = $state(false);

	constructor() {
		supabase.auth.getUser().then(({ data }) => {
			this.user = data.user;
			this.ready = true;
		});

		supabase.auth.onAuthStateChange((_event, session) => {
			this.user = session?.user ?? null;
		});
	}

	signInWithGitHub() {
		const siteUrl = import.meta.env.VITE_SITE_URL as string | undefined;
		const redirectTo = siteUrl ?? window.location.origin;

		return supabase.auth.signInWithOAuth({
			provider: 'github',
			options: { redirectTo }
		});
	}

	async signOut() {
		await supabase.auth.signOut();
		this.user = null;
	}
}

export const auth = new Auth();
