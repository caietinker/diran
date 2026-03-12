// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

declare module 'virtual:pwa-info' {
	export const pwaInfo:
		| {
				webManifest: {
					href: string;
				};
		  }
		| undefined;
}

declare module '$virtual/pwa-register' {
	export function registerSW(options?: {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onReady?: () => void;
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
		onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: any) => void;
	}): Promise<void>;
}

export {};
