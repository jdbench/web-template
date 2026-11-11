import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "./passwords.js";
import {
	createSession,
	createUser,
	deleteSession,
	getSession,
	getUser,
	updateUserProfileImage,
} from "./store.js";
import type { AuthInput, SessionUser, User } from "../types.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dummyHash = await hashPassword(randomBytes(24).toString("base64url"));

export class AuthError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
	) {
		super(message);
	}
}

const normalizeEmail = (email: unknown) =>
	typeof email === "string" ? email.trim().toLowerCase() : "";

const publicUser = ({
	id,
	email,
	name,
	profileImage,
}: User | (SessionUser & { profileImage?: string })) => ({ id, email, name, profileImage });

const validImage = (profileImage: unknown): string | null => {
	if (profileImage === null) return null;
	if (typeof profileImage !== "string") throw new AuthError(400, "Profile image is invalid.");

	const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(profileImage);
	if (!match) throw new AuthError(400, "Use a PNG, JPEG, or WebP profile image.");

	const bytes = Buffer.from(match[2]!, "base64");
	if (bytes.length === 0 || bytes.length > 128 * 1024) {
		throw new AuthError(400, "Profile image must be 128 KB or smaller.");
	}

	const signatures = {
		png: bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
		jpeg: bytes.subarray(0, 3).toString("hex") === "ffd8ff",
		webp: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP",
	};
	if (!signatures[match[1] as keyof typeof signatures])
		throw new AuthError(400, "Profile image content is invalid.");

	return profileImage;
};

const validateIdentity = (name: unknown, email: unknown) => {
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedEmail = normalizeEmail(email);

	if (normalizedName.length < 2 || normalizedName.length > 80) {
		throw new AuthError(400, "Name must be between 2 and 80 characters.");
	}
	if (normalizedEmail.length > 254 || !emailPattern.test(normalizedEmail)) {
		throw new AuthError(400, "Enter a valid email address.");
	}

	return { name: normalizedName, email: normalizedEmail };
};

const sessionResponse = async (user: User) => {
	const session = await createSession(user);
	return { ...session, user: publicUser(user) };
};

export const register = async ({ email, name, password }: AuthInput = {}) => {
	const identity = validateIdentity(name, email);
	let passwordHash;

	try {
		passwordHash = await hashPassword(password);
	} catch (error) {
		throw new AuthError(400, error instanceof Error ? error.message : "Password is invalid.");
	}

	try {
		const user = await createUser({ ...identity, passwordHash });
		return sessionResponse(user);
	} catch (error) {
		if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
			throw new AuthError(409, "An account with that email already exists.");
		}
		throw error;
	}
};

export const login = async ({ email, password }: AuthInput = {}) => {
	const normalizedEmail = normalizeEmail(email);
	const user = emailPattern.test(normalizedEmail) ? await getUser(normalizedEmail) : null;
	const validPassword = await verifyPassword(
		typeof password === "string" ? password : "",
		user?.passwordHash ?? dummyHash,
	);

	if (!user || !validPassword) throw new AuthError(401, "Email or password is incorrect.");
	return sessionResponse(user);
};

export const restoreSession = async ({ token }: AuthInput = {}) => {
	const session = await getSession(token);
	if (!session) throw new AuthError(401, "Session is invalid or expired.");
	const user = await getUser(session.email);
	return { user: publicUser(user ?? session) };
};

export const updateProfileImage = async ({ token, profileImage }: AuthInput = {}) => {
	const session = await getSession(token);
	if (!session) throw new AuthError(401, "Session is invalid or expired.");
	await updateUserProfileImage(session.email, validImage(profileImage));
	const user = await getUser(session.email);
	if (!user) throw new AuthError(404, "User is unavailable.");
	return { user: publicUser(user) };
};

export const logout = async ({ token }: AuthInput = {}) => {
	await deleteSession(token);
};
