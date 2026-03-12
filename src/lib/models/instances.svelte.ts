import { auth } from '$lib/auth.svelte';
import { tasks } from '$lib/models/tasks.svelte';
import { supabase } from '$lib/supabase';
import type { InstanceWithTask, Task } from '$lib/types';

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function shouldFireToday(task: Task): boolean {
	if (!task.repeat_freq) return false;

	const today = new Date();
	const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon..7=Sun

	if (task.repeat_freq === 'daily') return true;

	if (task.repeat_freq === 'weekly') {
		return task.repeat_days?.includes(dayOfWeek) ?? false;
	}

	if (task.repeat_freq === 'monthly') {
		return today.getDate() % (task.repeat_interval ?? 1) === 1;
	}

	return false;
}

class InstanceStore {
	items = $state<InstanceWithTask[]>([]);
	loading = $state(false);

	async ensureTodayInstances() {
		if (!auth.user) return;
		const today = todayStr();

		// Get existing instances for today
		const { data: existing } = await supabase.from('instance').select('task_id').eq('date', today);

		const existingTaskIds = new Set((existing ?? []).map((i) => i.task_id));

		// Create missing instances for repeating tasks that fire today
		const toCreate = tasks.items.filter((t) => !existingTaskIds.has(t.id) && shouldFireToday(t));

		if (toCreate.length > 0) {
			await supabase
				.from('instance')
				.insert(toCreate.map((t) => ({ task_id: t.id, date: today, status: 'pending' as const })));
		}
	}

	async fetchTimeline() {
		if (!auth.user) return;
		this.loading = true;
		const today = todayStr();

		// Fetch today's instances with their tasks and categories
		const { data, error } = await supabase
			.from('instance')
			.select('*, task!inner(*, category!inner(*))')
			.eq('date', today)
			.order('status', { ascending: true });

		if (!error && data) {
			this.items = data.map((row) => {
				const { task: taskData, ...inst } = row as Record<string, unknown>;
				const taskObj = taskData as Record<string, unknown>;
				const { category: catData, ...taskFields } = taskObj;
				return {
					...inst,
					task: { ...taskFields, category: catData }
				};
			}) as InstanceWithTask[];
		}
		this.loading = false;
	}

	async markDone(id: string) {
		const { error } = await supabase
			.from('instance')
			.update({ status: 'done' as const })
			.eq('id', id);
		if (!error) {
			this.items = this.items.map((i) => (i.id === id ? { ...i, status: 'done' as const } : i));
		}
	}

	async markSkipped(id: string) {
		const { error } = await supabase
			.from('instance')
			.update({ status: 'skipped' as const })
			.eq('id', id);
		if (!error) {
			this.items = this.items.map((i) => (i.id === id ? { ...i, status: 'skipped' as const } : i));
		}
	}

	async addOneOff(taskId: string) {
		const today = todayStr();
		const { data, error } = await supabase
			.from('instance')
			.insert({ task_id: taskId, date: today, status: 'pending' as const })
			.select('*, task!inner(*, category!inner(*))')
			.single();
		if (!error && data) {
			const { task: taskData, ...inst } = data as Record<string, unknown>;
			const taskObj = taskData as Record<string, unknown>;
			const { category: catData, ...taskFields } = taskObj;
			const mapped = {
				...inst,
				task: { ...taskFields, category: catData }
			} as InstanceWithTask;
			this.items = [...this.items, mapped];
		}
	}
}

export const instances = new InstanceStore();
