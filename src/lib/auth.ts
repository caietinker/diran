import type { User } from '@supabase/supabase-js';
import { writable } from 'svelte/store';
import { supabase } from './supabase';

export const user = writable<User | null>(null);

export async function initAuth() {
	const {
		data: { user: u }
	} = await supabase.auth.getUser();
	user.set(u);

	supabase.auth.onAuthStateChange((_event, session) => {
		user.set(session?.user ?? null);
	});
}

export async function signInWithGitHub() {
	await supabase.auth.signInWithOAuth({
		provider: 'github'
	});
}

export async function signOut() {
	await supabase.auth.signOut();
	user.set(null);
}
