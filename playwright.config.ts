import { defineConfig } from '@playwright/test';

// The suite runs against the dev server with a route-intercepted mock API —
// no live API anywhere. The API origin below is never actually listening;
// every request to it is fulfilled in-page by tests/mock-api.ts.
export default defineConfig({
	testDir: 'tests',
	fullyParallel: true,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:5173',
		// the design sways half the click targets forever; the kill-switch
		// (verified by motion.spec.ts) keeps the suite deterministic
		contextOptions: { reducedMotion: 'reduce' },
	},
	webServer: {
		command: 'npm run dev',
		url: 'http://127.0.0.1:5173',
		reuseExistingServer: !process.env.CI,
		env: { VITE_ARGSEA_API_URL: 'http://127.0.0.1:8181' },
	},
});
