import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ initializeAuth: vi.fn(), initializeOverview: vi.fn() }));
vi.mock("../../frontend/components/auth/auth.js", () => ({
	initializeAuth: mocks.initializeAuth,
}));
vi.mock("../../frontend/pages/overview/overview.js", () => ({
	initializeOverview: mocks.initializeOverview,
}));

describe("frontend entry point", () => {
	it("initializes the page and authentication controllers", async () => {
		await import("../../frontend/index.js");
		expect(mocks.initializeOverview).toHaveBeenCalledOnce();
		expect(mocks.initializeAuth).toHaveBeenCalledOnce();
	});
});
