<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import TaskModal from '$lib/components/TaskModal.svelte';
	import CategoryModal from '$lib/components/CategoryModal.svelte';
	import type { Category, Task } from '$lib/types';

	let category = $state<Category | null>(null);
	let categoryTasks = $derived(tasks.items.filter((t) => t.category_id === category?.id));

	// Task modal: null = closed; 'add' = new task; task = edit that task
	let taskModal = $state<null | 'add' | Task>(null);
	// Category modal: null = closed; true = edit current category
	let catModal = $state(false);

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

	async function onTaskModalClose(changed: boolean) {
		taskModal = null;
		if (changed) await loadCategory();
	}

	async function onCatModalClose(changed: boolean) {
		catModal = false;
		if (changed) {
			// If category was deleted, categories.items won't have it anymore
			const id = page.params.id;
			const still = categories.items.find((c) => c.id === id);
			if (!still) {
				void goto('/categories');
			} else {
				await loadCategory();
			}
		}
	}

	function describeRepeat(task: Task): string {
		if (!task.repeat_freq) return 'Once';
		const n = task.repeat_interval ?? 1;
		if (task.repeat_freq === 'daily') return n === 1 ? 'Daily' : `Every ${n} days`;
		if (task.repeat_freq === 'weekly') {
			const mask = task.repeat_weekdays ?? 0;
			const sel = dayFull.filter((_, i) => (mask & (1 << i)) !== 0);
			if (sel.length === 0) return 'Weekly';
			return (n > 1 ? `Every ${n} weeks on ` : 'Weekly on ') + sel.join(', ');
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

	function goalDisplay(cat: Category): string {
		if (cat.goal_type === 'times') return `${cat.goal_value}× / ${cat.goal_period}`;
		const hrs = Math.floor(cat.goal_value / 3600);
		const mins = Math.floor((cat.goal_value % 3600) / 60);
		const parts = [];
		if (hrs > 0) parts.push(`${hrs}h`);
		if (mins > 0) parts.push(`${mins}m`);
		return (parts.length ? parts.join(' ') : `${cat.goal_value}s`) + ` / ${cat.goal_period}`;
	}
</script>

<!-- ── Task modal ── -->
{#if taskModal !== null}
	{#if taskModal === 'add'}
		<TaskModal mode="add" defaultCategoryId={category?.id ?? ''} onclose={onTaskModalClose} />
	{:else}
		<TaskModal mode="edit" task={taskModal} onclose={onTaskModalClose} />
	{/if}
{/if}

<!-- ── Category edit modal ── -->
{#if catModal && category}
	<CategoryModal mode="edit" {category} onclose={onCatModalClose} />
{/if}

{#if category}
	<main class="mx-auto max-w-2xl px-4 py-6">
		<!-- ── Header ── -->
		<div class="mb-8">
			<a href="/categories" class="text-sm text-muted-foreground hover:text-foreground"
				>&larr; Back to categories</a
			>
			<div class="mt-4 flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<div class="h-5 w-5 shrink-0 rounded-md" style="background-color: {category.color}"></div>
					<div>
						<h1 class="text-2xl font-semibold tracking-tight text-foreground">{category.name}</h1>
						<p class="mt-0.5 text-sm text-muted-foreground">{goalDisplay(category)}</p>
					</div>
				</div>
				<button
					onclick={() => (catModal = true)}
					class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
				>
					Edit category
				</button>
			</div>
		</div>

		<!-- ── Tasks section ── -->
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
				Tasks ({categoryTasks.length})
			</h2>
			<button
				onclick={() => (taskModal = 'add')}
				class="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
			>
				+ Add task
			</button>
		</div>

		{#if categoryTasks.length === 0}
			<div class="rounded-xl border border-border bg-card px-6 py-10 text-center">
				<p class="text-sm text-muted-foreground">No tasks yet.</p>
				<button
					onclick={() => (taskModal = 'add')}
					class="mt-2 text-sm text-primary hover:underline"
				>
					Add your first task
				</button>
			</div>
		{:else}
			<div class="space-y-2">
				{#each categoryTasks as task (task.id)}
					<div
						class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/20"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-foreground">{task.name}</p>
							{#if task.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>
							{/if}
							<p class="mt-0.5 text-xs text-muted-foreground">{describeRepeat(task)}</p>
						</div>
						<button
							onclick={() => (taskModal = task)}
							class="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
						>
							Edit
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</main>
{/if}
