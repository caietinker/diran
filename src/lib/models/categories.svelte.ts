import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Category } from '$lib/types';

class CategoryStore {
	items = $state<Category[]>([]);
	loading = $state(false);

	async fetch() {
		if (!auth.user) return;
		this.loading = true;
		const { data, error } = await supabase.from('category').select('*').order('name');
		if (!error && data) this.items = data as Category[];
		this.loading = false;
	}

	async add(cat: Omit<Category, 'id' | 'user_id'>) {
		if (!auth.user) return;
		const { data, error } = await supabase
			.from('category')
			.insert({ ...cat, user_id: auth.user.id })
			.select()
			.single();
		if (!error && data) this.items = [...this.items, data as Category];
	}

	async update(id: string, updates: Partial<Omit<Category, 'id' | 'user_id'>>) {
		const { data, error } = await supabase
			.from('category')
			.update(updates)
			.eq('id', id)
			.select()
			.single();
		if (!error && data) {
			this.items = this.items.map((c) => (c.id === id ? (data as Category) : c));
		}
	}

	async remove(id: string) {
		const { error } = await supabase.from('category').delete().eq('id', id);
		if (!error) this.items = this.items.filter((c) => c.id !== id);
	}
}

export const categories = new CategoryStore();
