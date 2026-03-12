<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { getGoalProgress } from '$lib/models/progress';
	import Button from '$lib/components/ui/button/index.svelte';
	import type { GoalType, GoalPeriod } from '$lib/types';

	let showForm = $state(false);
	let name = $state('');
	let color = $state('#ff6600');
	let goalType = $state<GoalType>('times');
	let goalTimes = $state(1);
	let goalHours = $state(0);
	let goalMinutes = $state(30);
	let goalPeriod = $state<GoalPeriod>('week');

	let progress = $state<Record<string, { current: number; target: number }>>({});

	$effect(() => {
		categories.fetch().then(() => loadProgress());
	});

	async function loadProgress() {
		const result: Record<string, { current: number; target: number }> = {};
		for (const cat of categories.items) {
			result[cat.id] = await getGoalProgress(cat);
		}
		progress = result;
	}

	function getGoalValue(): number {
		if (goalType === 'times') return goalTimes;
		return goalHours * 3600 + goalMinutes * 60;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		await categories.add({
			name,
			color,
			goal_type: goalType,
			goal_value: getGoalValue(),
			goal_period: goalPeriod
		});
		name = '';
		color = '#ff6600';
		goalType = 'times';
		goalTimes = 1;
		goalHours = 0;
		goalMinutes = 30;
		goalPeriod = 'week';
		showForm = false;
		await loadProgress();
	}

	function formatGoal(type: GoalType, value: number, period: GoalPeriod): string {
		if (type === 'times') return `${value}x / ${period}`;
		const h = Math.floor(value / 3600);
		const m = Math.floor((value % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m / ${period}`;
		if (h > 0) return `${h}h / ${period}`;
		return `${m}m / ${period}`;
	}

	function progressPercent(catId: string): number {
		const p = progress[catId];
		if (!p || p.target === 0) return 0;
		return Math.min(Math.round((p.current / p.target) * 100), 100);
	}

	function formatCurrent(type: GoalType, current: number): string {
		if (type === 'times') return `${current}`;
		const h = Math.floor(current / 3600);
		const m = Math.floor((current % 3600) / 60);
		if (h > 0 && m > 0) return `${h}h ${m}m`;
		if (h > 0) return `${h}h`;
		return `${m}m`;
	}
</script>

<main class="mx-auto max-w-lg p-4">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-semibold text-foreground">Categories</h1>
		<button onclick={() => (showForm = !showForm)} class="text-sm text-primary hover:underline">
			{showForm ? 'cancel' : '+ new'}
		</button>
	</div>

	{#if showForm}
		<form onsubmit={handleCreate} class="mb-6 space-y-4 rounded border border-border bg-card p-4">
			<input
				type="text"
				bind:value={name}
				required
				placeholder="Category name"
				class="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
			/>

			<div class="flex gap-2">
				{#each ['#ff6600', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308'] as c}
					<button
						type="button"
						onclick={() => (color = c)}
						aria-label="Select color {c}"
						class="h-6 w-6 rounded-full {color === c ? 'ring-1 ring-foreground ring-offset-1' : ''}"
						style="background-color: {c}"
					></button>
				{/each}
			</div>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => (goalType = 'times')}
					class="flex-1 rounded border py-1.5 text-xs {goalType === 'times'
						? 'bg-foreground text-background'
						: 'border-border text-muted-foreground'}"
				>
					Times
				</button>
				<button
					type="button"
					onclick={() => (goalType = 'seconds')}
					class="flex-1 rounded border py-1.5 text-xs {goalType === 'seconds'
						? 'bg-foreground text-background'
						: 'border-border text-muted-foreground'}"
				>
					Duration
				</button>
			</div>

			{#if goalType === 'times'}
				<div class="flex gap-2">
					<input
						type="number"
						min="1"
						bind:value={goalTimes}
						class="w-20 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					/>
					<select
						bind:value={goalPeriod}
						class="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					>
						<option value="week">Week</option>
						<option value="month">Month</option>
						<option value="year">Year</option>
					</select>
				</div>
			{:else}
				<div class="flex gap-2">
					<input
						type="number"
						min="0"
						bind:value={goalHours}
						placeholder="h"
						class="w-16 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					/>
					<input
						type="number"
						min="0"
						max="59"
						bind:value={goalMinutes}
						placeholder="m"
						class="w-16 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					/>
					<select
						bind:value={goalPeriod}
						class="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					>
						<option value="week">Week</option>
						<option value="month">Month</option>
						<option value="year">Year</option>
					</select>
				</div>
			{/if}

			<Button type="submit" class="w-full">Create</Button>
		</form>
	{/if}

	{#if categories.loading}
		<p class="py-8 text-center text-muted-foreground">Loading...</p>
	{:else if categories.items.length === 0}
		<div class="rounded border border-border bg-card p-8 text-center">
			<p class="text-muted-foreground">No categories</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each categories.items as cat (cat.id)}
				{@const pct = progressPercent(cat.id)}
				{@const p = progress[cat.id]}
				<a
					href="/categories/{cat.id}"
					class="block rounded border border-border bg-card p-3 hover:border-primary/50"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded-full" style="background-color: {cat.color}"></div>
							<span class="font-medium text-foreground">{cat.name}</span>
						</div>
						<span class="text-xs text-muted-foreground">{pct}%</span>
					</div>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-muted">
						<div class="h-full bg-primary" style="width: {pct}%"></div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
