import { auth } from '$lib/auth.svelte';
import { supabase } from '$lib/supabase';
import type { Task, TaskWithCategory } from '$lib/types';

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}

function getTodayUnix(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return Math.floor(d.getTime() / 1000);
}

export function shouldFireOnDate(task: Task, date: Date): boolean {
	const dateUnix = Math.floor(date.setHours(0, 0, 0, 0) / 1000);
	const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
	const dayOfMonth = date.getDate();

	// Check if task has a specific date (one-off task)
	if (!task.repeat_freq) {
		// One-off task: fire only on start_date
		if (task.start_date) {
			const startMidnight = Math.floor(
				new Date(task.start_date * 1000).setHours(0, 0, 0, 0) / 1000
			);
			return dateUnix === startMidnight;
		}
		// Fallback: if no start_date, fire today
		return dateUnix === getTodayUnix();
	}

	// Check if task has started
	if (task.start_date && dateUnix < task.start_date) {
		return false;
	}

	// Check if task has ended
	if (task.end_date && dateUnix > task.end_date) {
		return false;
	}

	if (task.repeat_freq === 'daily') {
		const interval = task.repeat_interval ?? 1;
		return interval === 1;
	}

	if (task.repeat_freq === 'weekly') {
		const weekdayMask = task.repeat_weekdays ?? 0;
		const todayBit = 1 << (dayOfWeek - 1);
		return (weekdayMask & todayBit) !== 0;
	}

	if (task.repeat_freq === 'monthly') {
		const monthDayMask = task.repeat_month_days ?? 0;
		const todayBit = 1 << (dayOfMonth - 1);
		const matchesDay = (monthDayMask & todayBit) !== 0;
		if (!matchesDay) return false;
		const interval = task.repeat_interval ?? 1;
		return interval === 1;
	}

	return false;
}

export function getTaskStatusForDate(task: Task, dateUnix: number): 'pending' | 'done' | 'skipped' {
	// Check done_dates
	if (task.done_dates?.includes(dateUnix)) {
		return 'done';
	}
	// Check skipped_dates
	if (task.skipped_dates?.includes(dateUnix)) {
		return 'skipped';
	}
	return 'pending';
}

export interface TodayTask {
	task: TaskWithCategory;
	status: 'pending' | 'done' | 'skipped';
}

class HistoryStore {
	todayTasks = $state<TodayTask[]>([]);
	loading = $state(false);

	async fetchTodayTasks(
		tasks: Task[],
		categories: {
			id: string;
			name: string;
			color: string;
			goal_type: string;
			goal_value: number;
			goal_period: string;
		}[]
	) {
		if (!auth.user) return;
		this.loading = true;

		const today = getTodayUnix();
		const todayDate = new Date();

		// Compute today's tasks on the fly
		const computed: TodayTask[] = [];

		for (const task of tasks) {
			// Find the category
			const cat = categories.find((c) => c.id === task.category_id);
			if (!cat) continue;

			// Check if task fires today
			if (!shouldFireOnDate(task, todayDate)) continue;

			// Determine status
			const status = getTaskStatusForDate(task, today);

			computed.push({
				task: {
					...task,
					category: cat as unknown as import('$lib/types').Category
				},
				status
			});
		}

		// Sort: pending first, then done, then skipped
		computed.sort((a, b) => {
			const order = { pending: 0, done: 1, skipped: 2 };
			return order[a.status] - order[b.status];
		});

		this.todayTasks = computed;
		this.loading = false;
	}

	async markDone(taskId: string) {
		const today = getTodayUnix();

		// Update task's done_dates array
		const { data: task } = await supabase
			.from('task')
			.select('done_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentDone = task.done_dates || [];

		// Remove from skipped_dates if present
		const { data: task2 } = await supabase
			.from('task')
			.select('skipped_dates')
			.eq('id', taskId)
			.single();

		const currentSkipped = task2?.skipped_dates || [];
		const newSkipped = currentSkipped.filter((d: number) => d !== today);

		// Add to done_dates if not present
		if (!currentDone.includes(today)) {
			await supabase
				.from('task')
				.update({
					done_dates: [...currentDone, today],
					skipped_dates: newSkipped
				})
				.eq('id', taskId);
		}

		// Update local state
		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'done' as const } : t
		);
	}

	async markSkipped(taskId: string) {
		const today = getTodayUnix();

		// Update task's skipped_dates array
		const { data: task } = await supabase
			.from('task')
			.select('skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentSkipped = task.skipped_dates || [];

		// Remove from done_dates if present
		const { data: task2 } = await supabase
			.from('task')
			.select('done_dates')
			.eq('id', taskId)
			.single();

		const currentDone = task2?.done_dates || [];
		const newDone = currentDone.filter((d: number) => d !== today);

		// Add to skipped_dates if not present
		if (!currentSkipped.includes(today)) {
			await supabase
				.from('task')
				.update({
					done_dates: newDone,
					skipped_dates: [...currentSkipped, today]
				})
				.eq('id', taskId);
		}

		// Update local state
		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'skipped' as const } : t
		);
	}

	async restore(taskId: string) {
		const today = getTodayUnix();

		// Remove from both done_dates and skipped_dates
		const { data: task } = await supabase
			.from('task')
			.select('done_dates, skipped_dates')
			.eq('id', taskId)
			.single();

		if (!task) return;

		const currentDone = task.done_dates || [];
		const currentSkipped = task.skipped_dates || [];

		const newDone = currentDone.filter((d: number) => d !== today);
		const newSkipped = currentSkipped.filter((d: number) => d !== today);

		await supabase
			.from('task')
			.update({
				done_dates: newDone,
				skipped_dates: newSkipped
			})
			.eq('id', taskId);

		// Update local state
		this.todayTasks = this.todayTasks.map((t) =>
			t.task.id === taskId ? { ...t, status: 'pending' as const } : t
		);
	}

	async fetchForTask(taskId: string): Promise<{ id: string; date: string; status: string }[]> {
		const { data } = await supabase
			.from('history')
			.select('id, date, status')
			.eq('task_id', taskId)
			.order('date', { ascending: false })
			.limit(30);
		return (data ?? []) as { id: string; date: string; status: string }[];
	}
}

export const history = new HistoryStore();
