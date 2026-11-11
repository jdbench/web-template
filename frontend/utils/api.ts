export interface User {
	id: string;
	email: string;
	name: string;
	profileImage?: string;
}

export interface SessionResponse {
	token: string;
	user: User;
}

interface ApiError {
	error?: string;
}
export interface HealthResponse {
	timestamp: string;
}
export interface ContactResponse {
	requestId: string;
}
type Payload = Record<string, unknown>;

const request = async <Response>(path: string, options?: RequestInit): Promise<Response> => {
	const response = await fetch(path, options);
	const data = response.status === 204 ? {} : ((await response.json()) as unknown);

	if (!response.ok) {
		const error =
			typeof data === "object" && data !== null && "error" in data
				? (data as ApiError).error
				: undefined;
		throw new Error(error ?? `HTTP ${response.status}`);
	}
	return data as Response;
};

export const getHealth = () => request<HealthResponse>("/health");

export const submitContact = (payload: Payload) =>
	request<ContactResponse>("/contact", {
		method: "POST",
		headers: { "content-type": "text/plain" },
		body: JSON.stringify(payload),
	});

const post = <Response>(path: string, payload: Payload) =>
	request<Response>(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});

export const register = (payload: Payload) => post<SessionResponse>("/auth/register", payload);
export const login = (payload: Payload) => post<SessionResponse>("/auth/login", payload);
export const restoreSession = (token: string) =>
	post<Pick<SessionResponse, "user">>("/auth/session", { token });
export const logout = (token: string) => post<void>("/auth/logout", { token });
export const updateProfileImage = (token: string, profileImage: string | null) =>
	post<Pick<SessionResponse, "user">>("/auth/profile-image", { token, profileImage });
