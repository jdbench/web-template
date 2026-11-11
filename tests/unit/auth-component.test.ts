// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	login: vi.fn(),
	logout: vi.fn(),
	register: vi.fn(),
	restoreSession: vi.fn(),
	updateProfileImage: vi.fn(),
}));
vi.mock("../../frontend/utils/api.js", () => api);

const authMarkup = `
	<button class="header-sign-in" data-auth-open>Sign in</button>
	<button class="profile-avatar" data-auth-open data-avatar-button hidden>
		<img data-avatar-image hidden><span data-avatar-initial></span>
	</button>
	<input data-avatar-input type="file">
	<dialog data-auth-dialog aria-labelledby="account-title">
		<h2 id="account-title">Authentication</h2>
		<button data-auth-close>Close</button>
		<button data-auth-mode="login" role="tab" aria-controls="login">Sign in</button>
		<button data-auth-mode="register" role="tab" aria-controls="register">Register</button>
		<div class="auth-forms">
			<form data-auth-form="login" id="login" role="tabpanel" aria-label="Sign in">
				<input name="email"><input name="password"><button type="submit">Sign in</button>
			</form>
			<form data-auth-form="register" id="register" role="tabpanel" aria-label="Register" hidden>
				<input name="name"><input name="email"><input name="password"><button type="submit">Create</button>
			</form>
		</div>
		<div class="auth-user" hidden>
			<strong data-auth-name></strong><small data-auth-email></small>
			<button data-avatar-change>Change</button><button data-avatar-remove hidden>Remove</button>
			<button data-auth-logout>Sign out</button>
		</div>
		<p class="auth-result"></p>
	</dialog>`;

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
	document.body.innerHTML = authMarkup;
	Object.defineProperties(HTMLDialogElement.prototype, {
		showModal: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.setAttribute("open", "");
			},
		},
		close: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.removeAttribute("open");
			},
		},
	});
});

describe("authentication component", () => {
	it("registers, renders the account, and logs out", async () => {
		api.register.mockResolvedValue({
			token: "session-token",
			user: { id: "user-1", email: "user@example.com", name: "Test User" },
		});
		const { initializeAuth } = await import("../../frontend/components/auth/auth.js");
		await initializeAuth();

		document.querySelector<HTMLButtonElement>(".header-sign-in")?.click();
		document.querySelector<HTMLButtonElement>('[data-auth-mode="register"]')?.click();
		const form = document.querySelector<HTMLFormElement>('[data-auth-form="register"]')!;
		(form.elements.namedItem("name") as HTMLInputElement).value = "Test User";
		(form.elements.namedItem("email") as HTMLInputElement).value = "user@example.com";
		(form.elements.namedItem("password") as HTMLInputElement).value = "valid-password";
		form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

		await vi.waitFor(() =>
			expect(document.querySelector("[data-auth-name]")?.textContent).toBe("Test User"),
		);
		expect(sessionStorage.getItem("relay.session")).toBe("session-token");
		expect(document.querySelector("[data-avatar-initial]")?.textContent).toBe("T");

		document.querySelector<HTMLButtonElement>("[data-auth-logout]")?.click();
		await vi.waitFor(() => expect(api.logout).toHaveBeenCalledWith("session-token"));
		expect(sessionStorage.getItem("relay.session")).toBeNull();
		expect((document.querySelector(".header-sign-in") as HTMLElement).hidden).toBe(false);
	});

	it("restores stored sessions and supports keyboard tab changes", async () => {
		sessionStorage.setItem("relay.session", "stored-token");
		api.restoreSession.mockResolvedValue({
			user: { id: "user-1", email: "user@example.com", name: "Stored User" },
		});
		vi.resetModules();
		const { initializeAuth } = await import("../../frontend/components/auth/auth.js");
		await initializeAuth();
		expect(api.restoreSession).toHaveBeenCalledWith("stored-token");

		document.querySelector<HTMLButtonElement>("[data-avatar-button]")?.click();
		const loginTab = document.querySelector<HTMLButtonElement>('[data-auth-mode="login"]')!;
		loginTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(
			document.querySelector('[data-auth-mode="register"]')?.getAttribute("aria-selected"),
		).toBe("true");
	});
});
