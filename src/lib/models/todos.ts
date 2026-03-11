import { user } from '$lib/auth';
import { supabase } from '$lib/supabase';
import type { Todo } from '$lib/types/todo';
import { get, writable } from 'svelte/store';

export const todos = writable<Todo[]>([]);
export const todosLoading = writable(false);

export async function fetchTodos() {
	todosLoading.set(true);
	const currentUser = get(user);
	if (!currentUser) return;

	const { data, error } = await supabase
		.from('todos')
		.select('*')
		.eq('user_id', currentUser.id)
		.order('created_at', { ascending: false });

	if (!error && data) {
		todos.set(data);
	}
	todosLoading.set(false);
}

export async function addTodo(name: string) {
	const currentUser = get(user);
	if (!currentUser) return;

	const { data, error } = await supabase
		.from('todos')
		.insert({ name, user_id: currentUser.id })
		.select()
		.single();

	if (!error && data) {
		todos.update((t) => [data, ...t]);
	}
}

export async function removeTodo(id: string) {
	const { error } = await supabase.from('todos').delete().eq('id', id);

	if (!error) {
		todos.update((t) => t.filter((todo) => todo.id !== id));
	}
}
