<script lang="ts">
	import { todos, fetchTodos, addTodo, removeTodo, todosLoading } from '$lib/models/todos';
	import { user, signOut } from '$lib/auth';
	import Button from '$lib/components/ui/button/index.svelte';

	let newTodo = $state('');

	$effect(() => {
		if ($user) fetchTodos();
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (newTodo.trim()) {
			await addTodo(newTodo.trim());
			newTodo = '';
		}
	}
</script>

{#if !$user}
	<p class="p-4">Loading...</p>
{:else}
	<main class="mx-auto max-w-md p-4">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-semibold">Todos</h1>
			<Button variant="ghost" size="sm" onclick={signOut}>Sign out</Button>
		</div>

		<form onsubmit={handleSubmit} class="mb-6 flex gap-2">
			<input
				type="text"
				bind:value={newTodo}
				placeholder="Add a todo..."
				class="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm outline-none focus:border-neutral-400"
			/>
			<Button type="submit">Add</Button>
		</form>

		{#if $todosLoading}
			<p class="text-neutral-500">Loading...</p>
		{:else if $todos.length === 0}
			<p class="text-neutral-400">No todos yet</p>
		{:else}
			<ul class="space-y-2">
				{#each $todos as todo (todo.id)}
					<li
						class="flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-3"
					>
						<span>{todo.name}</span>
						<button onclick={() => removeTodo(todo.id)} class="text-neutral-400 hover:text-red-500">
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
{/if}
