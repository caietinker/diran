import { supabase } from '$lib/supabase';
import type { Category } from '$lib/types';
import { categories } from './categories.svelte';

/**
 * Progress store that caches completed-session values.
 * Live elapsed time for an active session is added in the UI via a $derived.
 */
class ProgressStore {
	values = $state<Record<string, { current: number; target: number }>>({});
	loading = $state(false);

	async refresh() {
		this.loading = true;
		const newValues: Record<string, { current: number; target: number }> = {};

		for (const cat of categories.items) {
			newValues[cat.id] = await getGoalProgressForCategory(cat);
		}

		this.values = newValues;
		this.loading = false;
	}

	async refreshCategory(categoryId: string) {
		const cat = categories.items.find((c) => c.id === categoryId);
		if (!cat) return;
		this.values[categoryId] = await getGoalProgressForCategory(cat);
	}

	get(categoryId: string): { current: number; target: number } | undefined {
		return this.values[categoryId];
	}
}

export const progress = new ProgressStore();

/**
 * Calculate goal progress for a category within its goal period.
 * Returns current (completed sessions only) and target (goal_value).
 * For 'times': counts history rows with status='done' within the period.
 * For 'seconds': sums completed session durations for tasks in the category.
 * Live elapsed time for any active session is added in the UI via a $derived.
 */
async function getGoalProgressForCategory(
	category: Category
): Promise<{ current: number; target: number }> {
	const now = new Date();
	let periodStartUnix: number;

	if (category.goal_period === 'week') {
		const day = now.getDay() === 0 ? 7 : now.getDay();
		const monday = new Date(now);
		monday.setDate(now.getDate() - (day - 1));
		monday.setHours(0, 0, 0, 0);
		periodStartUnix = Math.floor(monday.getTime() / 1000);
	} else if (category.goal_period === 'month') {
		const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
		periodStartUnix = Math.floor(firstOfMonth.getTime() / 1000);
	} else {
		// year
		const firstOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
		periodStartUnix = Math.floor(firstOfYear.getTime() / 1000);
	}

	const todayMidnight = new Date(now);
	todayMidnight.setHours(0, 0, 0, 0);
	const todayUnix = Math.floor(todayMidnight.getTime() / 1000);
	// Include today fully (period end = start of tomorrow)
	const periodEndUnix = todayUnix + 86400;

	// Fetch all task IDs in this category
	const { data: taskData } = await supabase
		.from('task')
		.select('id')
		.eq('category_id', category.id);

	const tasks = taskData ?? [];

	if (tasks.length === 0) return { current: 0, target: category.goal_value };

	if (category.goal_type === 'times') {
		// Count history rows with status='done' within the period date range
		const periodStartDate = new Date(periodStartUnix * 1000);
		const periodEndDate = new Date((periodEndUnix - 1) * 1000); // inclusive end (today)
		const toDateStr = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const startStr = toDateStr(periodStartDate);
		const endStr = toDateStr(periodEndDate);

		const taskIds = tasks.map((t) => t.id);
		if (taskIds.length === 0) return { current: 0, target: category.goal_value };

		const { count } = await supabase
			.from('history')
			.select('id', { count: 'exact', head: true })
			.in('task_id', taskIds)
			.eq('status', 'done')
			.gte('date', startStr)
			.lte('date', endStr);

		return { current: count ?? 0, target: category.goal_value };
	} else {
		// seconds: sum (ended_at - started_at) for all completed sessions in period
		const taskIds = tasks.map((t) => t.id);

		const { data: sessionData } = await supabase
			.from('session')
			.select('started_at, ended_at')
			.in('task_id', taskIds)
			.gte('started_at', periodStartUnix)
			.lt('started_at', periodEndUnix)
			.not('ended_at', 'is', null);

		let totalSeconds = (sessionData ?? []).reduce((sum, s) => {
			const row = s as { started_at: number; ended_at: number };
			return sum + (row.ended_at - row.started_at);
		}, 0);

		return { current: totalSeconds, target: category.goal_value };
	}
}
