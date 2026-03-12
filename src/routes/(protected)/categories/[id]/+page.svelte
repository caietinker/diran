<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { instances } from '$lib/models/instances.svelte';
	import Button from '$lib/components/ui/button/index.svelte';
	import type { RepeatFreq, Category, Task } from '$lib/types';

	let category = $state<Category | null>(null);
	let categoryTasks = $derived(tasks.items.filter((t) => t.category_id === category?.id));

	let showTaskForm = $state(false);
	let taskName = $state('');
	let repeatFreq = $state<RepeatFreq | ''>('');
	let repeatInterval = $state(1);
	let repeatDays = $state<number[]>([]);

	const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	$effect(() => {
		loadCategory();
	});

	async function loadCategory() {
		await categories.fetch();
		await tasks.fetch();
		const id = page.params.id;
		category = categories.items.find((c) => c.id === id) ?? null;
		if (!category) void goto('/categories');
	}

	async function handleAddTask(e: Event) {
		e.preventDefault();
		if (!category) return;

		const freq = repeatFreq === '' ? null : repeatFreq;
		const newTask = await tasks.add({
			category_id: category.id,
			name: taskName,
			repeat_freq: freq as RepeatFreq | null,
			repeat_interval: freq ? repeatInterval : null,
			repeat_days: freq === 'weekly' ? repeatDays : null
		});

		// For one-time tasks, create instance immediately
		if (!freq && newTask) {
			await instances.addOneOff(newTask.id);
		}

		taskName = '';
		repeatFreq = '';
		repeatInterval = 1;
		repeatDays = [];
		showTaskForm = false;
	}

	async function handleDeleteTask(id: string) {
		await tasks.remove(id);
	}

	async function handleDeleteCategory() {
		if (!category) return;
		await categories.remove(category.id);
		void goto('/categories');
	}

	function toggleDay(day: number) {
		if (repeatDays.includes(day)) {
			repeatDays = repeatDays.filter((d) => d !== day);
		} else {
			repeatDays = [...repeatDays, day].sort();
		}
	}

	function describeRepeat(task: Task): string {
		if (!task.repeat_freq) return 'One-time';
		if (task.repeat_freq === 'daily')
			return `Every ${task.repeat_interval === 1 ? '' : task.repeat_interval + ' '}day${task.repeat_interval === 1 ? '' : 's'}`;
		if (task.repeat_freq === 'weekly') {
			const days = (task.repeat_days ?? []).map((d) => dayLabels[d - 1]).join(', ');
			return `Weekly: ${days}`;
		}
		return `Every ${task.repeat_interval ?? 1} month(s)`;
	}
</script>

{#if category}
	<main class="mx-auto max-w-2xl p-6">
		<div class="mb-6">
			<a
				href="/categories"
				class="mb-2 inline-block text-sm text-muted-foreground hover:text-foreground"
				>&larr; Categories</a
			>
			<div class="flex items-center gap-3">
				<div class="h-5 w-5 rounded-full" style="background-color: {category.color}"></div>
				<h1 class="text-2xl font-semibold text-foreground">{category.name}</h1>
			</div>
			<p class="mt-1 text-sm text-muted-foreground">
				Goal: {category.goal_value}
				{category.goal_type === 'times' ? 'completions' : 'seconds'} per {category.goal_period}
			</p>
		</div>

		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-medium text-foreground">Tasks</h2>
			<Button size="sm" onclick={() => (showTaskForm = !showTaskForm)}>
				{showTaskForm ? 'Cancel' : 'Add Task'}
			</Button>
		</div>

		{#if showTaskForm}
			<form
				onsubmit={handleAddTask}
				class="mb-6 space-y-4 rounded-lg border border-border bg-card p-4"
			>
				<div>
					<label for="task-name" class="mb-1 block text-sm font-medium text-foreground"
						>Task name</label
					>
					<input
						id="task-name"
						type="text"
						bind:value={taskName}
						required
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
						placeholder="e.g. Morning run"
					/>
				</div>

				<div>
					<label for="repeat-freq" class="mb-1 block text-sm font-medium text-foreground"
						>Repeat</label
					>
					<select
						id="repeat-freq"
						bind:value={repeatFreq}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="">One-time (no repeat)</option>
						<option value="daily">Daily</option>
						<option value="weekly">Weekly</option>
						<option value="monthly">Monthly</option>
					</select>
				</div>

				{#if repeatFreq === 'weekly'}
					<div>
						<span class="mb-2 block text-sm font-medium text-foreground">Days</span>
						<div class="flex gap-2">
							{#each dayLabels as label, i (label)}
								{@const day = i + 1}
								<button
									type="button"
									onclick={() => toggleDay(day)}
									class="h-9 w-9 rounded-md text-xs font-medium transition-colors {repeatDays.includes(
										day
									)
										? 'bg-primary text-primary-foreground'
										: 'border border-input bg-background text-foreground hover:bg-accent'}"
								>
									{label.slice(0, 2)}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if repeatFreq && repeatFreq !== 'weekly'}
					<div>
						<label for="repeat-interval" class="mb-1 block text-sm font-medium text-foreground">
							Every N {repeatFreq === 'daily' ? 'days' : 'months'}
						</label>
						<input
							id="repeat-interval"
							type="number"
							min="1"
							bind:value={repeatInterval}
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
						/>
					</div>
				{/if}

				<Button type="submit">Create Task</Button>
			</form>
		{/if}

		{#if categoryTasks.length === 0}
			<div class="rounded-lg border border-border bg-card p-6 text-center">
				<p class="text-muted-foreground">No tasks yet. Add one above.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each categoryTasks as task (task.id)}
					<div
						class="flex items-center justify-between rounded-lg border border-border bg-card p-3"
					>
						<div>
							<p class="font-medium text-foreground">{task.name}</p>
							<p class="text-xs text-muted-foreground">{describeRepeat(task)}</p>
						</div>
						<button
							onclick={() => handleDeleteTask(task.id)}
							aria-label="Delete task"
							class="text-muted-foreground transition-colors hover:text-destructive"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-12 border-t border-border pt-6">
			<Button variant="destructive" size="sm" onclick={handleDeleteCategory}>Delete Category</Button
			>
		</div>
	</main>
{/if}
