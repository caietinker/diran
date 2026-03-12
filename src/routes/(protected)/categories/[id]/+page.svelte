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
	let repeatWeekdays = $state(0);
	let repeatMonthDays = $state(0);

	const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const dayFull = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

	function toggleWeekday(day: number) {
		repeatWeekdays ^= 1 << (day - 1);
	}

	function toggleMonthDay(day: number) {
		repeatMonthDays ^= 1 << (day - 1);
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
			repeat_weekdays: freq === 'weekly' ? repeatWeekdays : null,
			repeat_month_days: freq === 'monthly' ? repeatMonthDays : null
		});
		if (!freq && newTask) await instances.addOneOff(newTask.id);
		taskName = '';
		repeatFreq = '';
		repeatInterval = 1;
		repeatWeekdays = 0;
		repeatMonthDays = 0;
		showTaskForm = false;
	}

	async function handleDeleteTask(id: string) {
		await tasks.remove(id);
	}
	async function handleDeleteCategory() {
		if (category) {
			await categories.remove(category.id);
			void goto('/categories');
		}
	}

	function isWeekdaySelected(day: number): boolean {
		return (repeatWeekdays & (1 << (day - 1))) !== 0;
	}
	function isMonthDaySelected(day: number): boolean {
		return (repeatMonthDays & (1 << (day - 1))) !== 0;
	}

	function describeRepeat(task: Task): string {
		if (!task.repeat_freq) return 'Once';
		const n = task.repeat_interval ?? 1;
		if (task.repeat_freq === 'daily') return n === 1 ? 'Daily' : `Every ${n} days`;
		if (task.repeat_freq === 'weekly') {
			const mask = task.repeat_weekdays ?? 0;
			const sel = dayFull.filter((_, i) => (mask & (1 << i)) !== 0);
			if (sel.length === 0) return 'Weekly';
			return (n > 1 ? `Every ${n} weeks on ` : 'Weekly ') + sel.join(', ');
		}
		if (task.repeat_freq === 'monthly') {
			const mask = task.repeat_month_days ?? 0;
			const sel: string[] = [];
			for (let i = 0; i < 31; i++) if ((mask & (1 << i)) !== 0) sel.push(String(i + 1));
			if (sel.length === 0) return 'Monthly';
			return 'Monthly on day ' + sel.join(', ');
		}
		return task.repeat_freq;
	}
</script>

{#if category}
	<main class="mx-auto max-w-lg p-4">
		<div class="mb-6">
			<a href="/categories" class="text-sm text-muted-foreground hover:text-foreground"
				>&larr; Back</a
			>
			<div class="mt-2 flex items-center gap-2">
				<div class="h-4 w-4 rounded" style="background-color: {category.color}"></div>
				<h1 class="text-xl font-semibold text-foreground">{category.name}</h1>
			</div>
			<p class="mt-1 text-sm text-muted-foreground">
				{category.goal_value}
				{category.goal_type === 'times' ? 'x' : 'min'} / {category.goal_period}
			</p>
		</div>

		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-medium text-muted-foreground">Tasks</h2>
			<button
				onclick={() => (showTaskForm = !showTaskForm)}
				class="text-sm text-primary hover:underline"
			>
				{showTaskForm ? 'cancel' : '+ add'}
			</button>
		</div>

		{#if showTaskForm}
			<form
				onsubmit={handleAddTask}
				class="mb-6 space-y-3 rounded border border-border bg-card p-4"
			>
				<input
					type="text"
					bind:value={taskName}
					required
					placeholder="Task name"
					class="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>

				<div class="flex gap-1">
					{#each [{ v: '', l: 'Once' }, { v: 'daily', l: 'Daily' }, { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }] as opt}
						<button
							type="button"
							onclick={() => (repeatFreq = opt.v as RepeatFreq | '')}
							class="flex-1 rounded border py-1.5 text-xs {repeatFreq === opt.v
								? 'bg-foreground text-background'
								: 'border-border text-muted-foreground'}">{opt.l}</button
						>
					{/each}
				</div>

				{#if repeatFreq === 'daily'}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						Every <input
							type="number"
							min="1"
							bind:value={repeatInterval}
							class="w-16 rounded border border-border bg-background px-2 py-1 text-center text-foreground"
						/>
						day{repeatInterval > 1 ? 's' : ''}
					</div>
				{/if}

				{#if repeatFreq === 'weekly'}
					<div class="space-y-2">
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							Every <input
								type="number"
								min="1"
								bind:value={repeatInterval}
								class="w-12 rounded border border-border bg-background px-2 py-1 text-center text-foreground"
							/>
							week{repeatInterval > 1 ? 's' : ''} on
						</div>
						<div class="flex gap-1">
							{#each dayLabels as label, i}
								{@const day = i + 1}
								<button
									type="button"
									onclick={() => toggleWeekday(day)}
									class="flex-1 rounded py-1.5 text-xs {isWeekdaySelected(day)
										? 'bg-primary text-white'
										: 'border border-border text-muted-foreground'}">{label}</button
								>
							{/each}
						</div>
					</div>
				{/if}

				{#if repeatFreq === 'monthly'}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						Every <input
							type="number"
							min="1"
							bind:value={repeatInterval}
							class="w-12 rounded border border-border bg-background px-2 py-1 text-center text-foreground"
						/>
						month{repeatInterval > 1 ? 's' : ''} on days
					</div>
					<div class="grid grid-cols-7 gap-1">
						{#each Array(31) as _, i}
							{@const day = i + 1}
							<button
								type="button"
								onclick={() => toggleMonthDay(day)}
								class="rounded py-1 text-xs {isMonthDaySelected(day)
									? 'bg-primary text-white'
									: 'border border-border text-muted-foreground'}">{day}</button
							>
						{/each}
					</div>
				{/if}

				<Button type="submit" class="w-full">Add Task</Button>
			</form>
		{/if}

		{#if categoryTasks.length === 0}
			<div class="rounded border border-border bg-card p-6 text-center">
				<p class="text-muted-foreground">No tasks</p>
			</div>
		{:else}
			<div class="space-y-1">
				{#each categoryTasks as task (task.id)}
					<div class="flex items-center justify-between rounded border border-border bg-card p-3">
						<div>
							<p class="text-sm font-medium text-foreground">{task.name}</p>
							<p class="text-xs text-muted-foreground">{describeRepeat(task)}</p>
						</div>
						<button
							onclick={() => handleDeleteTask(task.id)}
							class="text-muted-foreground hover:text-destructive">✕</button
						>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-8 border-t border-border pt-4">
			<button onclick={handleDeleteCategory} class="text-sm text-destructive hover:underline"
				>Delete category</button
			>
		</div>
	</main>
{/if}
