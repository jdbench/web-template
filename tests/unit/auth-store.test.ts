import { beforeEach, describe, expect, it, vi } from "vitest";

const dynamoRequest = vi.hoisted(() => vi.fn());
vi.mock("../../handlers/aws/dynamodb.js", () => ({ dynamoRequest }));

const { createSession, createUser, deleteSession, getSession, getUser, updateUserProfileImage } =
	await import("../../handlers/auth/store.js");

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

describe("authentication store", () => {
	it("maps complete users and rejects incomplete records", async () => {
		dynamoRequest.mockResolvedValueOnce({
			Item: {
				userId: { S: "user-1" },
				email: { S: "user@example.com" },
				name: { S: "Test User" },
				passwordHash: { S: "hash" },
				createdAt: { S: "created" },
				profileImage: { S: "image" },
			},
		});
		await expect(getUser("user@example.com")).resolves.toMatchObject({ id: "user-1" });

		dynamoRequest.mockResolvedValueOnce({ Item: { email: { S: "user@example.com" } } });
		await expect(getUser("user@example.com")).resolves.toBeNull();
	});

	it("creates users and sessions with protected keys", async () => {
		dynamoRequest.mockResolvedValue({});
		const created = await createUser({
			email: "user@example.com",
			name: "Test User",
			passwordHash: "hash",
		});
		expect(created.id).toEqual(expect.any(String));
		expect(dynamoRequest).toHaveBeenLastCalledWith(
			"PutItem",
			expect.objectContaining({ ConditionExpression: "attribute_not_exists(pk)" }),
		);

		const session = await createSession(created);
		expect(session.token).toHaveLength(43);
		const sessionInput = dynamoRequest.mock.calls.at(-1)?.[1] as {
			Item: { pk: { S: string } };
		};
		expect(sessionInput.Item.pk.S).toMatch(/^SESSION#[a-f0-9]{64}$/);
		expect(sessionInput.Item.pk.S).not.toContain(session.token);
	});

	it("deletes expired sessions and ignores malformed tokens", async () => {
		dynamoRequest.mockResolvedValueOnce({
			Item: { expiresAt: { N: "1" }, userId: { S: "id" }, email: { S: "e" }, name: { S: "n" } },
		});
		await expect(getSession("x".repeat(32))).resolves.toBeNull();
		expect(dynamoRequest).toHaveBeenLastCalledWith("DeleteItem", expect.any(Object));

		vi.clearAllMocks();
		await deleteSession("short");
		expect(dynamoRequest).not.toHaveBeenCalled();
	});

	it("uses SET and REMOVE profile image updates", async () => {
		dynamoRequest.mockResolvedValue({});
		await updateUserProfileImage("user@example.com", "image");
		expect(dynamoRequest).toHaveBeenLastCalledWith(
			"UpdateItem",
			expect.objectContaining({ UpdateExpression: "SET profileImage = :profileImage" }),
		);
		await updateUserProfileImage("user@example.com", null);
		expect(dynamoRequest).toHaveBeenLastCalledWith(
			"UpdateItem",
			expect.objectContaining({ UpdateExpression: "REMOVE profileImage" }),
		);
	});
});
