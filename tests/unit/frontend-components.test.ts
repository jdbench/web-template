// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getHealth: vi.fn(), submitContact: vi.fn() }));
vi.mock("../../frontend/utils/api.js", () => api);

const { initializeContactForm } = await import(
	"../../frontend/components/contact-form/contactForm.js"
);
const { checkHealth } = await import("../../frontend/components/service-status/serviceStatus.js");

beforeEach(() => {
	vi.clearAllMocks();
	document.body.innerHTML = "";
});

describe("frontend components", () => {
	it("submits and resets the contact form", async () => {
		document.body.innerHTML = `
			<form data-contact-form>
				<input name="name" value="Test User">
				<input name="email" value="user@example.com">
				<textarea name="message">Hello</textarea>
				<p class="form-result"></p>
				<button type="submit">Send request</button>
			</form>`;
		api.submitContact.mockResolvedValue({ requestId: "12345678-abcd" });
		initializeContactForm();

		document
			.querySelector("form")
			?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
		await vi.waitFor(() =>
			expect(document.querySelector(".form-result")?.textContent).toBe("Accepted / 12345678"),
		);
		expect(api.submitContact).toHaveBeenCalledWith({
			name: "Test User",
			email: "user@example.com",
			message: "Hello",
		});
		expect(document.querySelector("button")?.textContent).toBe("Send request");
	});

	it("shows contact submission errors", async () => {
		document.body.innerHTML = `<form data-contact-form><p class="form-result"></p><button type="submit">Send request</button></form>`;
		api.submitContact.mockRejectedValue(new Error("Network unavailable"));
		initializeContactForm();
		document
			.querySelector("form")
			?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
		await vi.waitFor(() =>
			expect(document.querySelector(".form-result")?.textContent).toBe("Network unavailable"),
		);
		expect((document.querySelector(".form-result") as HTMLElement).dataset.state).toBe("error");
	});

	it("renders healthy and unavailable service states", async () => {
		document.body.innerHTML = `
			<button class="icon-button"></button>
			<strong class="api-status"></strong>
			<small class="api-detail"></small>`;
		api.getHealth.mockResolvedValue({ timestamp: "2026-01-01T12:00:00.000Z" });
		await checkHealth();
		expect(document.querySelector(".api-status")?.textContent).toContain("Operational");
		expect(document.querySelector(".status-dot")?.classList).toContain("online");
		expect(document.querySelector(".icon-button")?.classList).not.toContain("spinning");

		api.getHealth.mockRejectedValue(new Error("Offline"));
		await checkHealth();
		expect(document.querySelector(".api-status")?.textContent).toContain("Unavailable");
		expect(document.querySelector(".api-detail")?.textContent).toBe("Offline");
	});
});
