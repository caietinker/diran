<script lang="ts">
	import { categories } from '$lib/models/categories.svelte';
	import { tasks } from '$lib/models/tasks.svelte';
	import { instances } from '$lib/models/instances.svelte';
	import { sessions } from '$lib/models/sessions.svelte';
	import Button from '$lib/components/ui/button/index.svelte';
	import type { InstanceWithTask } from '$lib/types';

	let elapsed = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		loadData();
		return () => {
			if (timerInterval) clearInterval(timerInterval);
		};
	});

	// Keep the timer ticking when a session is active
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
		if (sessions.active?.instance_id === inst.id) {
			await sessions.stop();
		}
		await instances.markDone(inst.id);
	}

	async function markSkipped(inst: InstanceWithTask) {
		if (sessions.active?.instance_id === inst.id) {
			await sessions.stop();
		}
		await instances.markSkipped(inst.id);
	}

	function formatTime(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		if (h > 0) return `${h}h ${m}m ${s}s`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	function todayFormatted(): string {
		return new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	const pending = $derived(instances.items.filter((i) => i.status === 'pending'));
	const completed = $derived(instances.items.filter((i) => i.status !== 'pending'));
</script>

<main class="mx-auto max-w-2xl p-6">
	<div class="mb-8">
		<h1 class="text-2xl font-semibold text-foreground">Today</h1>
		<p class="text-sm text-muted-foreground">{todayFormatted()}</p>
	</div>

	{#if instances.loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if instances.items.length === 0}
		<div class="rounded-lg border border-border bg-card p-8 text-center">
			<p class="text-muted-foreground">No tasks for today.</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create categories and tasks in the <a href="/categories" class="text-primary underline"
					>Categories</a
				> page.
			</p>
		</div>
	{:else}
		<!-- Pending -->
		{#if pending.length > 0}
			<div class="space-y-3">
				{#each pending as inst (inst.id)}
					{@const isActive = sessions.active?.instance_id === inst.id}
					<div
						class="flex items-center gap-4 rounded-lg border p-4 transition-colors {isActive
							? 'border-primary/50 bg-primary/5'
							: 'border-border bg-card'}"
					>
						<div
							class="h-3 w-3 shrink-0 rounded-full"
							style="background-color: {inst.task.category.color}"
						></div>

						<div class="min-w-0 flex-1">
							<p class="font-medium text-foreground">{inst.task.name}</p>
							<p class="text-xs text-muted-foreground">{inst.task.category.name}</p>
						</div>

						{#if isActive}
							<span class="font-mono text-sm font-medium text-primary">
								{formatTime(elapsed)}
							</span>
						{/if}

						<div class="flex items-center gap-1.5">
							<Button
								size="sm"
								variant={isActive ? 'default' : 'outline'}
								onclick={() => toggleSession(inst)}
							>
								{isActive ? 'Stop' : 'Start'}
							</Button>
							<Button size="sm" variant="ghost" onclick={() => markDone(inst)}>Done</Button>
							<Button size="sm" variant="ghost" onclick={() => markSkipped(inst)}>Skip</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Completed / Skipped -->
		{#if completed.length > 0}
			<div class="mt-8">
				<h2 class="mb-3 text-sm font-medium text-muted-foreground">Completed</h2>
				<div class="space-y-2">
					{#each completed as inst (inst.id)}
						<div
							class="flex items-center gap-4 rounded-lg border border-border bg-card/50 p-3 opacity-60"
						>
							<div
								class="h-3 w-3 shrink-0 rounded-full"
								style="background-color: {inst.task.category.color}"
							></div>
							<div class="min-w-0 flex-1">
								<p class="text-sm text-foreground {inst.status === 'done' ? 'line-through' : ''}">
									{inst.task.name}
								</p>
							</div>
							<span class="text-xs text-muted-foreground capitalize">{inst.status}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
