// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ checkHealth: vi.fn(), initializeContactForm: vi.fn() }));
vi.mock("../../frontend/components/contact-form/contactForm.js", () => ({
	initializeContactForm: mocks.initializeContactForm,
}));
vi.mock("../../frontend/components/service-status/serviceStatus.js", () => ({
	checkHealth: mocks.checkHealth,
}));

const { initializeOverview } = await import("../../frontend/pages/overview/overview.js");

beforeEach(() => {
	vi.clearAllMocks();
	document.body.innerHTML = `<button class="icon-button"></button>`;
});

describe("overview", () => {
	it("initializes contact and health controls", () => {
		initializeOverview();
		expect(mocks.initializeContactForm).toHaveBeenCalledOnce();
		expect(mocks.checkHealth).toHaveBeenCalledOnce();
		document.querySelector<HTMLButtonElement>(".icon-button")?.click();
		expect(mocks.checkHealth).toHaveBeenCalledTimes(2);
	});
});
