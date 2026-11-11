import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createSession: vi.fn(),
	createUser: vi.fn(),
	deleteSession: vi.fn(),
	getSession: vi.fn(),
	getUser: vi.fn(),
	hashPassword: vi.fn(),
	updateUserProfileImage: vi.fn(),
	verifyPassword: vi.fn(),
}));

vi.mock("../../handlers/auth/passwords.js", () => ({
	hashPassword: mocks.hashPassword,
	verifyPassword: mocks.verifyPassword,
}));
vi.mock("../../handlers/auth/store.js", () => ({
	createSession: mocks.createSession,
	createUser: mocks.createUser,
	deleteSession: mocks.deleteSession,
	getSession: mocks.getSession,
	getUser: mocks.getUser,
	updateUserProfileImage: mocks.updateUserProfileImage,
}));

const { AuthError, login, logout, register, restoreSession, updateProfileImage } = await import(
	"../../handlers/auth/service.js"
);

const user = {
	id: "user-1",
	email: "user@example.com",
	name: "Test User",
	passwordHash: "stored-hash",
	createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.hashPassword.mockResolvedValue("new-hash");
	mocks.createUser.mockResolvedValue(user);
	mocks.createSession.mockResolvedValue({ token: "token", expiresAt: 123 });
});

describe("authentication service", () => {
	it("normalizes registration data and hides password hashes", async () => {
		await expect(
			register({ name: "  Test User  ", email: " USER@EXAMPLE.COM ", password: "password" }),
		).resolves.toEqual({
			token: "token",
			expiresAt: 123,
			user: { id: "user-1", email: "user@example.com", name: "Test User" },
		});
		expect(mocks.createUser).toHaveBeenCalledWith({
			name: "Test User",
			email: "user@example.com",
			passwordHash: "new-hash",
		});
	});

	it("rejects invalid and duplicate registrations", async () => {
		await expect(register({ name: "x", email: "invalid" })).rejects.toMatchObject({
			statusCode: 400,
		});

		const duplicate = new Error("duplicate");
		duplicate.name = "ConditionalCheckFailedException";
		mocks.createUser.mockRejectedValueOnce(duplicate);
		await expect(
			register({ name: "Test User", email: "user@example.com", password: "password" }),
		).rejects.toEqual(new AuthError(409, "An account with that email already exists."));
	});

	it("creates sessions only for valid credentials", async () => {
		mocks.getUser.mockResolvedValue(user);
		mocks.verifyPassword.mockResolvedValue(true);
		await expect(
			login({ email: " USER@EXAMPLE.COM ", password: "password" }),
		).resolves.toMatchObject({
			token: "token",
		});

		mocks.verifyPassword.mockResolvedValue(false);
		await expect(login({ email: "user@example.com", password: "wrong" })).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("restores sessions and falls back to the session identity", async () => {
		mocks.getSession.mockResolvedValue({ id: user.id, email: user.email, name: user.name });
		mocks.getUser.mockResolvedValue(null);
		await expect(restoreSession({ token: "token" })).resolves.toEqual({
			user: { id: user.id, email: user.email, name: user.name },
		});

		mocks.getSession.mockResolvedValue(null);
		await expect(restoreSession({ token: "invalid" })).rejects.toMatchObject({ statusCode: 401 });
	});

	it("validates profile image content and logs out", async () => {
		mocks.getSession.mockResolvedValue({ id: user.id, email: user.email, name: user.name });
		mocks.getUser.mockResolvedValue(user);
		const png = `data:image/png;base64,${Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		]).toString("base64")}`;

		await expect(updateProfileImage({ token: "token", profileImage: png })).resolves.toEqual({
			user: { id: user.id, email: user.email, name: user.name },
		});
		expect(mocks.updateUserProfileImage).toHaveBeenCalledWith(user.email, png);

		await expect(
			updateProfileImage({ token: "token", profileImage: "data:image/png;base64,YmFk" }),
		).rejects.toMatchObject({ statusCode: 400 });

		await logout({ token: "token" });
		expect(mocks.deleteSession).toHaveBeenCalledWith("token");
	});
});
