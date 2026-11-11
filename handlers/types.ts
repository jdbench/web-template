export interface User {
	id: string;
	email: string;
	name: string;
	passwordHash: string;
	createdAt: string;
	profileImage?: string;
}

export type SessionUser = Pick<User, "id" | "email" | "name">;

export interface AuthInput {
	email?: unknown;
	message?: unknown;
	name?: unknown;
	password?: unknown;
	profileImage?: unknown;
	token?: unknown;
}

export interface DynamoAttribute {
	N?: string;
	S?: string;
}

export type DynamoItem = Record<string, DynamoAttribute | undefined>;

export interface LambdaEvent {
	body?: string | null;
	headers?: Record<string, string | undefined>;
	httpMethod?: string;
	isBase64Encoded?: boolean;
	path?: string;
	rawPath?: string;
	requestContext?: { http?: { method?: string } };
}
