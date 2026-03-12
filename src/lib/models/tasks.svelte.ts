import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Task } from '$lib/types';

class TaskStore {
	items = $state<Task[]>([]);
	loading = $state(false);

	async fetch() {
		if (!auth.user) return;
		this.loading = true;
		const { data, error } = await supabase
			.from('task')
			.select('*, category!inner(user_id)')
			.order('name');
		if (!error && data) {
			this.items = data.map(({ category, ...rest }) => rest) as Task[];
		}
		this.loading = false;
	}

	async add(task: Omit<Task, 'id'>) {
		const { data, error } = await supabase.from('task').insert(task).select().single();
		if (!error && data) this.items = [...this.items, data as Task];
		return data as Task | null;
	}

	async update(id: string, updates: Partial<Omit<Task, 'id'>>) {
		const { data, error } = await supabase
			.from('task')
			.update(updates)
			.eq('id', id)
			.select()
			.single();
		if (!error && data) {
			this.items = this.items.map((t) => (t.id === id ? (data as Task) : t));
		}
	}

	async remove(id: string) {
		const { error } = await supabase.from('task').delete().eq('id', id);
		if (!error) this.items = this.items.filter((t) => t.id !== id);
	}
}

export const tasks = new TaskStore();
