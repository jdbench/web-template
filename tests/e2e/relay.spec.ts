import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, request }) => {
	await expect
		.poll(
			async () =>
				request
					.get("/health")
					.then((response) => response.status())
					.catch(() => 0),
			{ message: "integration Lambda should become healthy", timeout: 60_000 },
		)
		.toBe(200);
	await page.goto("/");
});

test("renders the workspace and exposes an accessible authentication dialog", async ({ page }) => {
	await expect(page.getByRole("heading", { level: 1, name: "System overview" })).toBeVisible();
	await expect(page.locator(".api-status")).toContainText("Operational");

	const signIn = page.getByRole("button", { name: "Sign in" });
	await signIn.click();

	const dialog = page.getByRole("dialog", { name: "Authentication" });
	await expect(dialog).toBeVisible();
	const signInPanel = dialog.getByRole("tabpanel", { name: "Sign in" });
	await expect(signInPanel.getByLabel("Email")).toBeFocused();

	const loginTab = dialog.getByRole("tab", { name: "Sign in" });
	await loginTab.focus();
	await loginTab.press("ArrowRight");
	await expect(dialog.getByRole("tab", { name: "Register" })).toHaveAttribute(
		"aria-selected",
		"true",
	);

	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(signIn).toBeFocused();
});

test("registers, restores, and signs out a user", async ({ page }) => {
	const email = `integration-${crypto.randomUUID()}@example.com`;
	await page.getByRole("button", { name: "Sign in" }).click();
	const dialog = page.getByRole("dialog", { name: "Authentication" });
	await dialog.getByRole("tab", { name: "Register" }).click();
	const registerPanel = dialog.getByRole("tabpanel", { name: "Register" });

	await registerPanel.getByLabel("Name").fill("Integration User");
	await registerPanel.getByLabel("Email").fill(email);
	await registerPanel.getByLabel("Password").fill("Integration-Test-Password-24!");
	await registerPanel.getByRole("button", { name: "Create account" }).click();

	await expect(dialog.getByRole("status")).toHaveText("Account created.");
	await expect(page.getByRole("button", { name: "Open account" })).toBeVisible();

	await page.reload();
	await expect(page.getByRole("button", { name: "Open account" })).toBeVisible();
	await page.getByRole("button", { name: "Open account" }).click();
	await expect(dialog.getByText(email)).toBeVisible();
	await dialog.getByRole("button", { name: "Sign out" }).click();
	await expect(page.getByRole("banner").getByRole("button", { name: "Sign in" })).toBeVisible();
});
