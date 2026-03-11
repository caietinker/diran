import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Todo } from '$lib/types/todo';
import { writable } from 'svelte/store';

export const todos = writable<Todo[]>([]);
export const todosLoading = writable(false);

export async function fetchTodos() {
	if (!auth.user) return;
	todosLoading.set(true);

	const { data, error } = await supabase
		.from('todos')
		.select('*')
		.eq('user_id', auth.user.id)
		.order('created_at', { ascending: false });

	if (!error && data) {
		todos.set(data as Todo[]);
	}
	todosLoading.set(false);
}

export async function addTodo(name: string) {
	if (!auth.user) return;

	const { data, error } = await supabase
		.from('todos')
		.insert({ name, user_id: auth.user.id })
		.select()
		.single();

	if (!error && data) {
		todos.update((t) => [data as Todo, ...t]);
	}
}

export async function removeTodo(id: string) {
	const { error } = await supabase.from('todos').delete().eq('id', id);

	if (!error) {
		todos.update((t) => t.filter((todo) => todo.id !== id));
	}
}
