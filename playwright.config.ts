import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	outputDir: "test-results",
});
