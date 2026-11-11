import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getHealth,
	login,
	logout,
	register,
	restoreSession,
	submitContact,
	updateProfileImage,
} from "../../frontend/utils/api.js";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

afterEach(() => vi.unstubAllGlobals());

describe("frontend API client", () => {
	it("reads health and reports API errors", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ timestamp: "now" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getHealth()).resolves.toEqual({ timestamp: "now" });
		expect(fetchMock).toHaveBeenCalledWith("/health", undefined);

		fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Unavailable" }, 503));
		await expect(getHealth()).rejects.toThrow("Unavailable");

		fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
		await expect(getHealth()).rejects.toThrow("HTTP 500");
	});

	it("serializes contact and authentication requests", async () => {
		const fetchMock = vi.fn<(path: string, options?: RequestInit) => Promise<Response>>(() =>
			Promise.resolve(jsonResponse({ user: {}, token: "token" })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await submitContact({ message: "Hello" });
		expect(fetchMock).toHaveBeenLastCalledWith("/contact", {
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: JSON.stringify({ message: "Hello" }),
		});

		await register({ email: "user@example.com" });
		await login({ email: "user@example.com" });
		await restoreSession("session-token");
		await updateProfileImage("session-token", null);
		expect(fetchMock.mock.calls.slice(1).map(([path]) => path)).toEqual([
			"/auth/register",
			"/auth/login",
			"/auth/session",
			"/auth/profile-image",
		]);
	});

	it("handles empty logout responses", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(logout("session-token")).resolves.toEqual({});
	});
});
