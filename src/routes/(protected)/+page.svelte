<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { instances } from '$lib/models/instances.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import Button from '$lib/components/ui/button/index.svelte';
	import type { InstanceWithTask, Category } from '$lib/types';

	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let showQuickAdd = $state(false);
	let quickTaskName = $state('');
	let quickCategoryId = $state('');

	$effect(() => {
		loadData();
		return () => {
			if (timerInterval) clearInterval(timerInterval);
		};
	});

	$effect(() => {
		if (sessions.active) {
			timerInterval = setInterval(() => {
				elapsed = Math.floor(Date.now() / 1000) - sessions.active!.started_at;
			}, 1000);
		} else {
			if (timerInterval) clearInterval(timerInterval);
			timerInterval = null;
			elapsed = 0;
		}
	});

	async function loadData() {
		await categories.fetch();
		await tasks.fetch();
		await instances.ensureTodayInstances();
		await instances.fetchTimeline();
		await sessions.checkActive();
	}

	async function toggleSession(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) {
			await sessions.stop();
		} else {
			if (sessions.active) await sessions.stop();
			await sessions.start(inst.id);
		}
	}

	async function markDone(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) await sessions.stop();
		await instances.markDone(inst.id);
	}

	async function markSkipped(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) await sessions.stop();
		await instances.markSkipped(inst.id);
	}

	async function handleQuickAdd(e: Event) {
		e.preventDefault();
		if (!quickTaskName.trim() || !quickCategoryId) return;

		const newTask = await tasks.add({
			category_id: quickCategoryId,
			name: quickTaskName.trim(),
			repeat_freq: null,
			repeat_interval: null,
			repeat_weekdays: null,
			repeat_month_days: null
		});

		if (newTask) {
			await instances.addOneOff(newTask.id);
		}

		quickTaskName = '';
		quickCategoryId = '';
		showQuickAdd = false;
		await loadData();
	}

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	const pending = $derived(instances.items.filter((i) => i.status === 'pending'));
	const completed = $derived(instances.items.filter((i) => i.status !== 'pending'));
</script>

<main class="mx-auto max-w-lg p-4">
	<div class="mb-6 flex items-end justify-between">
		<div>
			<h1 class="text-xl font-semibold text-foreground">Today</h1>
			<p class="text-sm text-muted-foreground">{todayFormatted()}</p>
		</div>
		<button
			onclick={() => (showQuickAdd = !showQuickAdd)}
			class="text-sm text-primary hover:underline"
		>
			{showQuickAdd ? 'cancel' : '+ add task'}
		</button>
	</div>

	{#if showQuickAdd}
		<form onsubmit={handleQuickAdd} class="mb-4 flex gap-2">
			<input
				type="text"
				bind:value={quickTaskName}
				placeholder="Task name"
				class="flex-1 rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
			/>
			<select
				bind:value={quickCategoryId}
				class="rounded border border-border bg-card px-2 text-sm text-foreground"
			>
				<option value="">category</option>
				{#each categories.items as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
			<Button type="submit" size="sm">Add</Button>
		</form>
	{/if}

	{#if instances.loading}
		<p class="py-8 text-center text-muted-foreground">Loading...</p>
	{:else if instances.items.length === 0}
		<div class="rounded border border-border bg-card p-8 text-center">
			<p class="text-muted-foreground">No tasks for today</p>
			<p class="mt-1 text-sm text-muted-foreground">
				<a href="/categories" class="text-primary">Create categories</a> to get started
			</p>
		</div>
	{:else}
		{#if pending.length > 0}
			<div class="space-y-1">
				{#each pending as inst (inst.id)}
					{@const isActive = sessions.active?.instance_id === inst.id}
					<div
						class="flex items-center gap-3 rounded border border-border bg-card p-3 {isActive
							? 'border-primary'
							: ''}"
					>
						<div
							class="h-2 w-2 shrink-0 rounded-full"
							style="background-color: {inst.task.category.color}"
						></div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-foreground">{inst.task.name}</p>
						</div>
						{#if isActive}
							<span class="font-mono text-xs text-primary">{formatTime(elapsed)}</span>
						{/if}
						<button
							onclick={() => toggleSession(inst)}
							class="rounded px-2 py-1 text-xs {isActive
								? 'bg-primary text-white'
								: 'border border-border text-muted-foreground'}"
						>
							{isActive ? 'stop' : 'start'}
						</button>
						<button
							onclick={() => markDone(inst)}
							class="text-muted-foreground hover:text-foreground">✓</button
						>
						<button
							onclick={() => markSkipped(inst)}
							class="text-muted-foreground hover:text-foreground">✕</button
						>
					</div>
				{/each}
			</div>
		{/if}

		{#if completed.length > 0}
			<div class="mt-6">
				<p class="mb-2 text-xs font-medium text-muted-foreground uppercase">Done</p>
				<div class="space-y-1">
					{#each completed as inst (inst.id)}
						<div
							class="flex items-center gap-3 rounded border border-border bg-card/50 p-2 opacity-50"
						>
							<div
								class="h-2 w-2 shrink-0 rounded-full"
								style="background-color: {inst.task.category.color}"
							></div>
							<p
								class="flex-1 text-sm text-muted-foreground {inst.status === 'done'
									? 'line-through'
									: ''}"
							>
								{inst.task.name}
							</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
