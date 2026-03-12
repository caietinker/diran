import { supabase } from '$lib/supabase';
import type { Session } from '$lib/types';

class SessionStore {
	active = $state<Session | null>(null);
	loading = $state(false);

	async start(taskId: string) {
		const now = Math.floor(Date.now() / 1000);
		const { data, error } = await supabase
			.from('session')
			.insert({ task_id: taskId, started_at: now })
			.select()
			.single();
		if (!error && data) this.active = data as Session;
	}

	async stop() {
		if (!this.active) return;
		const now = Math.floor(Date.now() / 1000);
		const { error } = await supabase
			.from('session')
			.update({ ended_at: now })
			.eq('id', this.active.id);
		if (!error) {
			this.active = null;
		}
	}

	async checkActive() {
		const { data } = await supabase
			.from('session')
			.select('*')
			.is('ended_at', null)
			.limit(1)
			.single();
		if (data) this.active = data as Session;
	}

	async fetchForTask(taskId: string): Promise<Session[]> {
		const { data } = await supabase
			.from('session')
			.select('*')
			.eq('task_id', taskId)
			.order('started_at', { ascending: true });
		return (data ?? []) as Session[];
	}
}

export const sessions = new SessionStore();
