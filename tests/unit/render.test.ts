import { describe, expect, it } from "vitest";

import { readAsset, renderOverview } from "../../handlers/web/render.js";

describe("server renderer", () => {
	it("composes the overview without unresolved template tokens", () => {
		const html = renderOverview();
		expect(html).toContain("<!doctype html>");
		expect(html).toContain("System overview");
		expect(html).toContain("Authentication");
		expect(html).not.toContain("{{");
		expect(html).not.toMatch(/>\s+</);
	});

	it("allows only generated public asset names", async () => {
		await expect(readAsset("../index.html")).resolves.toBeNull();
		await expect(readAsset("unknown.js")).resolves.toBeNull();
		await expect(readAsset("app.min.js")).resolves.toBeNull();
	});
});
