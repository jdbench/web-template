import { createHash, randomBytes, randomUUID } from "node:crypto";

import { dynamoRequest } from "../aws/dynamodb.js";
import type { DynamoItem, SessionUser, User } from "../types.js";

const tableName = process.env.AUTH_TABLE_NAME ?? "web-template-auth";
const sessionDurationSeconds = Number(process.env.SESSION_DURATION_SECONDS ?? 86_400);

const userKey = (email: string) => `USER#${email}`;
const sessionKey = (token: string) => `SESSION#${createHash("sha256").update(token).digest("hex")}`;

const readString = (item: DynamoItem, name: string) => item[name]?.S;

const userFromItem = (item?: DynamoItem): User | null => {
	if (!item) return null;
	const id = readString(item, "userId");
	const email = readString(item, "email");
	const name = readString(item, "name");
	const passwordHash = readString(item, "passwordHash");
	const createdAt = readString(item, "createdAt");
	if (!id || !email || !name || !passwordHash || !createdAt) return null;
	return {
		id,
		email,
		name,
		passwordHash,
		createdAt,
		profileImage: readString(item, "profileImage"),
	};
};

export const getUser = async (email: string) => {
	const result = await dynamoRequest<{ Item?: DynamoItem }>("GetItem", {
		TableName: tableName,
		Key: { pk: { S: userKey(email) } },
		ConsistentRead: true,
	});
	return userFromItem(result.Item);
};

export const createUser = async ({
	email,
	name,
	passwordHash,
}: Pick<User, "email" | "name" | "passwordHash">) => {
	const user = {
		id: randomUUID(),
		email,
		name,
		passwordHash,
		createdAt: new Date().toISOString(),
	};

	await dynamoRequest("PutItem", {
		TableName: tableName,
		Item: {
			pk: { S: userKey(email) },
			entityType: { S: "user" },
			userId: { S: user.id },
			email: { S: user.email },
			name: { S: user.name },
			passwordHash: { S: user.passwordHash },
			createdAt: { S: user.createdAt },
		},
		ConditionExpression: "attribute_not_exists(pk)",
	});

	return user;
};

export const createSession = async (user: SessionUser) => {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds;

	await dynamoRequest("PutItem", {
		TableName: tableName,
		Item: {
			pk: { S: sessionKey(token) },
			entityType: { S: "session" },
			userId: { S: user.id },
			email: { S: user.email },
			name: { S: user.name },
			expiresAt: { N: String(expiresAt) },
			createdAt: { S: new Date().toISOString() },
		},
	});

	return { token, expiresAt };
};

export const getSession = async (token: unknown): Promise<SessionUser | null> => {
	if (typeof token !== "string" || token.length < 32) return null;

	const key = { pk: { S: sessionKey(token) } };
	const result = await dynamoRequest<{ Item?: DynamoItem }>("GetItem", {
		TableName: tableName,
		Key: key,
		ConsistentRead: true,
	});
	const item = result.Item;

	if (!item) return null;
	if (Number(item.expiresAt?.N) <= Math.floor(Date.now() / 1000)) {
		await dynamoRequest("DeleteItem", { TableName: tableName, Key: key });
		return null;
	}

	const id = readString(item, "userId");
	const email = readString(item, "email");
	const name = readString(item, "name");
	return id && email && name ? { id, email, name } : null;
};

export const deleteSession = async (token: unknown) => {
	if (typeof token !== "string" || token.length < 32) return;
	await dynamoRequest("DeleteItem", {
		TableName: tableName,
		Key: { pk: { S: sessionKey(token) } },
	});
};

export const updateUserProfileImage = async (email: string, profileImage: string | null) => {
	const input: Record<string, unknown> = {
		TableName: tableName,
		Key: { pk: { S: userKey(email) } },
		ConditionExpression: "attribute_exists(pk)",
	};

	if (profileImage) {
		input.UpdateExpression = "SET profileImage = :profileImage";
		input.ExpressionAttributeValues = { ":profileImage": { S: profileImage } };
	} else {
		input.UpdateExpression = "REMOVE profileImage";
	}

	await dynamoRequest("UpdateItem", input);
};
