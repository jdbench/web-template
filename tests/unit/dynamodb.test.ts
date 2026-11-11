import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("AWS_ACCESS_KEY_ID", "access-key");
	vi.stubEnv("AWS_SECRET_ACCESS_KEY", "secret-key");
	vi.stubEnv("AWS_SESSION_TOKEN", "session-token");
	vi.stubEnv("AWS_DEFAULT_REGION", "us-east-1");
	vi.stubEnv("DYNAMODB_ENDPOINT", "http://dynamodb.local:4566");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("DynamoDB client", () => {
	it("signs and sends DynamoDB JSON requests", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ Item: {} }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const { dynamoRequest } = await import("../../handlers/aws/dynamodb.js");

		await expect(dynamoRequest("GetItem", { TableName: "table" })).resolves.toEqual({ Item: {} });
		const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
		const headers = options.headers as Record<string, string>;
		expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=access-key/");
		expect(headers["x-amz-target"]).toBe("DynamoDB_20120810.GetItem");
		expect(headers["x-amz-security-token"]).toBe("session-token");
	});

	it("maps AWS errors and requires credentials", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ __type: "aws#ConditionalCheckFailedException", message: "no" }),
					{
						status: 400,
					},
				),
			),
		);
		let client = await import("../../handlers/aws/dynamodb.js");
		await expect(client.dynamoRequest("PutItem", {})).rejects.toMatchObject({
			name: "ConditionalCheckFailedException",
			message: "no",
		});

		vi.resetModules();
		vi.stubEnv("AWS_ACCESS_KEY_ID", "");
		client = await import("../../handlers/aws/dynamodb.js");
		await expect(client.dynamoRequest("GetItem", {})).rejects.toThrow(
			"AWS credentials are not available.",
		);
	});
});
