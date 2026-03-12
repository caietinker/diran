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
	const dayOfMonth = today.getDate();
	const monthNum = today.getMonth() + 1; // 1-12

	if (task.repeat_freq === 'daily') {
		// Every N days - simplified: fire every day for now
		// To properly implement every N days, we'd track first instance date
		const interval = task.repeat_interval ?? 1;
		return interval === 1; // Only fire daily if interval is 1
	}

	if (task.repeat_freq === 'weekly') {
		// Check weekday bitmask (bit0 = Mon)
		const weekdayMask = task.repeat_weekdays ?? 0;
		const todayBit = 1 << (dayOfWeek - 1);
		return (weekdayMask & todayBit) !== 0;
	}

	if (task.repeat_freq === 'monthly') {
		// Check month day bitmask (bit0 = day 1)
		const monthDayMask = task.repeat_month_days ?? 0;
		const todayBit = 1 << (dayOfMonth - 1);
		const matchesDay = (monthDayMask & todayBit) !== 0;

		if (!matchesDay) return false;

		// Check interval (every N months)
		const interval = task.repeat_interval ?? 1;
		// For simplicity, fire every month if interval is 1
		// Full implementation would track first instance month
		return interval === 1;
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
