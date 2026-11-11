import { describe, expect, it } from "vitest";

import { hashPassword, validatePassword, verifyPassword } from "../../handlers/auth/passwords.js";

describe("passwords", () => {
	it("accepts valid password lengths and rejects invalid values", () => {
		expect(() => validatePassword("valid-password")).not.toThrow();
		expect(() => validatePassword("too-short")).toThrow(
			"Password must be between 12 and 128 characters.",
		);
		expect(() => validatePassword(42)).toThrow();
		expect(() => validatePassword("x".repeat(129))).toThrow();
	});

	it("creates salted hashes and verifies only the original password", async () => {
		const password = "correct horse battery staple";
		const firstHash = await hashPassword(password);
		const secondHash = await hashPassword(password);

		expect(firstHash).toMatch(/^scrypt\$16384\$8\$1\$/);
		expect(secondHash).not.toBe(firstHash);
		await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
		await expect(verifyPassword("incorrect password", firstHash)).resolves.toBe(false);
		await expect(verifyPassword(password, "invalid-hash")).resolves.toBe(false);
	});
});
