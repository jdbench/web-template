import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = (
	password: string,
	salt: Buffer,
	keyLength: number,
	options: Parameters<typeof scryptCallback>[3],
) =>
	new Promise<Buffer>((resolve, reject) => {
		scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
			if (error) reject(error);
			else resolve(derivedKey);
		});
	});
const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 32 * 1024 * 1024;

export function validatePassword(password: unknown): asserts password is string {
	if (typeof password !== "string" || password.length < 12 || password.length > 128) {
		throw new Error("Password must be between 12 and 128 characters.");
	}
}

export const hashPassword = async (password: unknown) => {
	validatePassword(password);
	const salt = randomBytes(16);
	const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
		N: COST,
		r: BLOCK_SIZE,
		p: PARALLELIZATION,
		maxmem: MAX_MEMORY,
	});

	return [
		"scrypt",
		COST,
		BLOCK_SIZE,
		PARALLELIZATION,
		salt.toString("base64url"),
		derivedKey.toString("base64url"),
	].join("$");
};

export const verifyPassword = async (password: string, storedHash: string) => {
	try {
		const [algorithm, cost, blockSize, parallelization, salt, expected] = storedHash.split("$");
		if (algorithm !== "scrypt" || !salt || !expected) return false;

		const expectedKey = Buffer.from(expected, "base64url");
		const actualKey = await scrypt(password, Buffer.from(salt, "base64url"), expectedKey.length, {
			N: Number(cost),
			r: Number(blockSize),
			p: Number(parallelization),
			maxmem: MAX_MEMORY,
		});

		return expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
	} catch {
		return false;
	}
};
