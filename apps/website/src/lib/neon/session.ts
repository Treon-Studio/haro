import { verifySession } from "@/lib/auth/session";

function getSessionToken(
	cookies: { get: (name: string) => { value?: string } | undefined } | undefined,
	request: Request | undefined,
): string | null {
	if (cookies) {
		try {
			const cookie = cookies.get("tenang-session");
			if (cookie?.value) return cookie.value;
		} catch {
			// Ignore
		}
	}

	if (request?.headers) {
		const headers = request.headers;
		const cookieHeader =
			headers instanceof Headers ? headers.get("cookie") : (headers as any).cookie;
		if (cookieHeader) {
			const match = cookieHeader.match(/tenang-session=([^;]+)/);
			if (match) return match[1];
		}
	}
	return null;
}

export async function getCurrentUserId(context: {
	cookies?: { get: (name: string) => { value?: string } | undefined };
	request?: Request;
}): Promise<string> {
	const token = getSessionToken(context.cookies, context.request);

	if (!token) {
		throw new Error("NO_TOKEN");
	}

	const payload = await verifySession(token);

	if (!payload) {
		throw new Error("INVALID_SESSION");
	}

	return payload.userId;
}