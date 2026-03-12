import type { TaskWithCategory } from '$lib/types';

export function ordinal(n: number): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
	if (mod10 === 1) return `${n}st`;
	if (mod10 === 2) return `${n}nd`;
	if (mod10 === 3) return `${n}rd`;
	return `${n}th`;
}

export function joinDays(parts: string[]): string {
	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0];
	if (parts.length === 2) return `${parts[0]} & ${parts[1]}`;
	return parts.join(', ');
}

export function describeSchedule(task: TaskWithCategory): string {
	if (task.repeat_freq === null && !task.start_date) return '';

	if (task.repeat_freq === null && task.start_date) {
		return new Date(task.start_date * 1000).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short'
		});
	}

	const interval = task.repeat_interval ?? 1;

	if (task.repeat_freq === 'daily') {
		return interval === 1 ? 'every day' : `every ${interval} days`;
	}

	if (task.repeat_freq === 'weekly') {
		const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
		const mask = task.repeat_weekdays ?? 0;
		const days: string[] = [];
		for (let i = 0; i < 7; i++) {
			if (mask & (1 << i)) days.push(dayNames[i]);
		}
		const base = joinDays(days);
		return interval === 1 ? base : `${base} · ${interval}wk`;
	}

	if (task.repeat_freq === 'monthly') {
		const mask = task.repeat_month_days ?? 0;
		const dayNums: number[] = [];
		for (let i = 0; i < 31; i++) {
			if (mask & (1 << i)) dayNums.push(i + 1);
		}
		let parts: string[];
		if (dayNums.length > 3) {
			const extra = dayNums.length - 2;
			parts = [ordinal(dayNums[0]), ordinal(dayNums[1]), `+${extra} more`];
		} else {
			parts = dayNums.map(ordinal);
		}
		const base = joinDays(parts);
		return interval === 1 ? base : `${base} · ${interval}mo`;
	}

	return '';
}

export function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatShortTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m`;
	return '0m';
}
