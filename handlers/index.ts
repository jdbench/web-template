import { randomUUID } from "node:crypto";

import {
	AuthError,
	login,
	logout,
	register,
	restoreSession,
	updateProfileImage,
} from "./auth/service.js";
import { readAsset, renderOverview } from "./web/render.js";
import type { AuthInput, LambdaEvent } from "./types.js";

const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "*";
const allowInsecureAuth = process.env.ALLOW_INSECURE_AUTH === "true";

const response = (statusCode: number, body: unknown) => ({
	statusCode,
	headers: {
		"access-control-allow-headers": "content-type",
		"access-control-allow-methods": "GET,POST,OPTIONS",
		"access-control-allow-origin": allowedOrigin,
		"cache-control": "no-store",
		"content-type": "application/json",
		pragma: "no-cache",
	},
	body: JSON.stringify(body),
});

const webResponse = (
	statusCode: number,
	body: string,
	contentType: string,
	cacheControl = "no-store",
) => ({
	statusCode,
	headers: {
		"cache-control": cacheControl,
		"content-security-policy":
			"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
		"content-type": contentType,
		"referrer-policy": "strict-origin-when-cross-origin",
		"x-content-type-options": "nosniff",
		"x-frame-options": "DENY",
	},
	body,
});

const parseBody = (event: LambdaEvent): AuthInput => {
	if (!event.body) return {};
	const rawBody = event.isBase64Encoded
		? Buffer.from(event.body, "base64").toString("utf8")
		: event.body;
	return JSON.parse(rawBody) as AuthInput;
};

const isSecureRequest = (event: LambdaEvent) => {
	if (allowInsecureAuth) return true;
	const forwardedProtocol =
		event.headers?.["x-forwarded-proto"] ?? event.headers?.["X-Forwarded-Proto"];
	return String(forwardedProtocol).toLowerCase() === "https";
};

export const handler = async (event: LambdaEvent = {}) => {
	const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
	const path = event.rawPath ?? event.path ?? "/health";

	if (method === "OPTIONS") return response(204, {});

	if (method === "POST" && path.includes("/auth/") && !isSecureRequest(event)) {
		return response(426, { error: "Authentication requires HTTPS." });
	}

	if (method === "GET" && path === "/") {
		return webResponse(200, renderOverview(), "text/html; charset=utf-8");
	}

	if (method === "GET" && path.startsWith("/assets/")) {
		const asset = await readAsset(path.slice("/assets/".length));
		if (!asset) return webResponse(404, "Not found", "text/plain; charset=utf-8");
		return webResponse(200, asset.body, asset.contentType, "no-cache");
	}

	if (method === "GET" && path.endsWith("/health")) {
		return response(200, {
			service: "web-template-api",
			status: "healthy",
			timestamp: new Date().toISOString(),
		});
	}

	if (method === "POST" && path.endsWith("/auth/register")) {
		try {
			return response(201, await register(parseBody(event)));
		} catch (error) {
			if (error instanceof AuthError) return response(error.statusCode, { error: error.message });
			console.error("Registration failed", error);
			return response(500, { error: "Registration is temporarily unavailable." });
		}
	}

	if (method === "POST" && path.endsWith("/auth/login")) {
		try {
			return response(200, await login(parseBody(event)));
		} catch (error) {
			if (error instanceof AuthError) return response(error.statusCode, { error: error.message });
			console.error("Login failed", error);
			return response(500, { error: "Login is temporarily unavailable." });
		}
	}

	if (method === "POST" && path.endsWith("/auth/session")) {
		try {
			return response(200, await restoreSession(parseBody(event)));
		} catch (error) {
			if (error instanceof AuthError) return response(error.statusCode, { error: error.message });
			console.error("Session lookup failed", error);
			return response(500, { error: "Session lookup is temporarily unavailable." });
		}
	}

	if (method === "POST" && path.endsWith("/auth/logout")) {
		try {
			await logout(parseBody(event));
			return response(204, {});
		} catch (error) {
			console.error("Logout failed", error);
			return response(500, { error: "Logout is temporarily unavailable." });
		}
	}

	if (method === "POST" && path.endsWith("/auth/profile-image")) {
		try {
			return response(200, await updateProfileImage(parseBody(event)));
		} catch (error) {
			if (error instanceof AuthError) return response(error.statusCode, { error: error.message });
			console.error("Profile image update failed", error);
			return response(500, { error: "Profile image update is temporarily unavailable." });
		}
	}

	if (method === "POST" && path.endsWith("/contact")) {
		try {
			const { email, message, name } = parseBody(event);

			if (
				typeof name !== "string" ||
				typeof email !== "string" ||
				typeof message !== "string" ||
				!name.trim() ||
				!email.trim() ||
				!message.trim()
			) {
				return response(400, { error: "Name, email, and message are required." });
			}

			return response(202, {
				message: "Request accepted.",
				requestId: randomUUID(),
			});
		} catch {
			return response(400, { error: "Request body must be valid JSON." });
		}
	}

	return response(404, { error: "Route not found." });
};
