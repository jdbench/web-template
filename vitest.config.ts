import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/unit/**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["frontend/**/*.ts", "handlers/**/*.ts"],
			exclude: ["handlers/types.ts"],
			reporter: ["text", "json-summary", "html"],
			reportsDirectory: "coverage",
			thresholds: {
				statements: 75,
				branches: 65,
				functions: 85,
				lines: 80,
			},
		},
	},
});
