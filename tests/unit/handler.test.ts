import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	login: vi.fn(),
	logout: vi.fn(),
	readAsset: vi.fn(),
	register: vi.fn(),
	renderOverview: vi.fn(),
	restoreSession: vi.fn(),
	updateProfileImage: vi.fn(),
}));

vi.mock("../../handlers/auth/service.js", () => ({
	AuthError: class AuthError extends Error {
		constructor(
			public readonly statusCode: number,
			message: string,
		) {
			super(message);
		}
	},
	...mocks,
}));
vi.mock("../../handlers/web/render.js", () => ({
	readAsset: mocks.readAsset,
	renderOverview: mocks.renderOverview,
}));

const { handler } = await import("../../handlers/index.js");

beforeEach(() => {
	vi.clearAllMocks();
	mocks.renderOverview.mockReturnValue("<html>Relay</html>");
});

describe("Lambda router", () => {
	it("serves pages, assets, health, preflight, and not-found responses", async () => {
		await expect(
			handler({ rawPath: "/", requestContext: { http: { method: "GET" } } }),
		).resolves.toMatchObject({
			statusCode: 200,
			body: "<html>Relay</html>",
		});

		mocks.readAsset.mockResolvedValue({ body: "css", contentType: "text/css" });
		await expect(handler({ rawPath: "/assets/app.min.css" })).resolves.toMatchObject({
			statusCode: 200,
		});
		await expect(handler({ rawPath: "/health" })).resolves.toMatchObject({ statusCode: 200 });
		await expect(handler({ httpMethod: "OPTIONS" })).resolves.toMatchObject({ statusCode: 204 });
		await expect(handler({ rawPath: "/missing" })).resolves.toMatchObject({ statusCode: 404 });
	});

	it("requires HTTPS and routes successful authentication", async () => {
		await expect(handler({ rawPath: "/auth/login", httpMethod: "POST" })).resolves.toMatchObject({
			statusCode: 426,
		});

		mocks.login.mockResolvedValue({ token: "token" });
		await expect(
			handler({
				rawPath: "/auth/login",
				httpMethod: "POST",
				headers: { "x-forwarded-proto": "https" },
				body: Buffer.from(JSON.stringify({ email: "user@example.com" })).toString("base64"),
				isBase64Encoded: true,
			}),
		).resolves.toMatchObject({ statusCode: 200 });
		expect(mocks.login).toHaveBeenCalledWith({ email: "user@example.com" });
	});

	it("validates contact requests", async () => {
		await expect(
			handler({ rawPath: "/contact", httpMethod: "POST", body: "not-json" }),
		).resolves.toMatchObject({ statusCode: 400 });
		await expect(
			handler({
				rawPath: "/contact",
				httpMethod: "POST",
				body: JSON.stringify({ name: "Test", email: "test@example.com", message: "Hello" }),
			}),
		).resolves.toMatchObject({ statusCode: 202 });
	});
});
