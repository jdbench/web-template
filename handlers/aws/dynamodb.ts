import { createHash, createHmac, type BinaryLike } from "node:crypto";

const service = "dynamodb";
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = new URL(
	process.env.DYNAMODB_ENDPOINT ?? `https://dynamodb.${region}.amazonaws.com`,
);

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: BinaryLike, value: string) => createHmac("sha256", key).update(value).digest();
const readErrorString = (value: unknown, fallback: string) =>
	typeof value === "string" ? value : fallback;

const credentials = () => {
	const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

	if (!accessKeyId || !secretAccessKey) throw new Error("AWS credentials are not available.");
	return { accessKeyId, secretAccessKey, sessionToken: process.env.AWS_SESSION_TOKEN };
};

const authorizationHeaders = (target: string, body: string) => {
	const { accessKeyId, secretAccessKey, sessionToken } = credentials();
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);
	const headers: Record<string, string> = {
		"content-type": "application/x-amz-json-1.0",
		host: endpoint.host,
		"x-amz-date": amzDate,
		"x-amz-target": `DynamoDB_20120810.${target}`,
	};

	if (sessionToken) headers["x-amz-security-token"] = sessionToken;

	const signedHeaders = Object.keys(headers).sort();
	const canonicalHeaders = signedHeaders
		.map((name) => `${name}:${headers[name]!.trim()}\n`)
		.join("");
	const canonicalRequest = [
		"POST",
		endpoint.pathname || "/",
		"",
		canonicalHeaders,
		signedHeaders.join(";"),
		sha256(body),
	].join("\n");
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		sha256(canonicalRequest),
	].join("\n");
	const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
	const regionKey = hmac(dateKey, region);
	const serviceKey = hmac(regionKey, service);
	const signingKey = hmac(serviceKey, "aws4_request");
	const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

	return {
		...headers,
		authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`,
	};
};

export const dynamoRequest = async <
	Result extends Record<string, unknown> = Record<string, unknown>,
>(
	target: string,
	input: Record<string, unknown>,
): Promise<Result> => {
	const body = JSON.stringify(input);
	const response = await fetch(endpoint, {
		method: "POST",
		headers: authorizationHeaders(target, body),
		body,
	});
	const result = (await response.json()) as Record<string, unknown>;

	if (!response.ok) {
		const message = readErrorString(
			result.message,
			readErrorString(result.Message, "DynamoDB request failed."),
		);
		const type = readErrorString(result.__type, readErrorString(result.code, "DynamoDbError"));
		const error = new Error(message);
		error.name = type.split("#").at(-1) ?? "DynamoDbError";
		throw error;
	}

	return result as Result;
};
