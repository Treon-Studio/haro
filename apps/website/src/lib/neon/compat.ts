import { verifySession } from "@/lib/auth/session";
import { query } from "./client";

function validateIdentifier(name: string): void {
	const parts = name.split(",").map((s) => s.trim());
	for (const part of parts) {
		if (part === "*") continue;
		if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
			throw new Error(`Invalid SQL identifier: ${name}`);
		}
	}
}

/**
 * Helper to extract session token from context (Astro's APIContext or AstroGlobal)
 */
// biome-ignore lint/suspicious/noExplicitAny: APIContext / AstroGlobal has varying shapes depending on context
function getSessionToken(context: any): string | null {
	if (context?.cookies?.get) {
		try {
			const cookie = context.cookies.get("tenang-session");
			if (cookie?.value) return cookie.value;
		} catch {
			// Ignore
		}
	}

	if (context?.request?.headers) {
		const headers = context.request.headers;
		const cookieHeader =
			headers instanceof Headers ? headers.get("cookie") : headers.cookie;
		if (cookieHeader) {
			const match = cookieHeader.match(/tenang-session=([^;]+)/);
			if (match) return match[1];
		}
	}
	return null;
}

// biome-ignore lint/suspicious/noExplicitAny: generic parameters for compatibility with PostgREST-style API
export class QueryBuilder<T = any>
	// biome-ignore lint/suspicious/noExplicitAny: PostgREST error structure is dynamically typed
	implements PromiseLike<{ data: T[] | null; error: any | null }>
{
	private tableName: string;
	private type: "select" | "insert" | "update" | "upsert" | "delete" = "select";
	private selectCols = "*";
	private insertData: unknown = null;
	private updateData: unknown = null;
	private upsertData: unknown = null;
	private filters: { col: string; op: "eq" | "is" | "in"; val: unknown }[] = [];
	private orderClauses: { col: string; ascending: boolean }[] = [];
	private limitVal: number | null = null;
	private context?: unknown;
	private rlsInjected = false;

	constructor(tableName: string, context?: unknown) {
		this.tableName = tableName;
		this.context = context;
	}

	select(columns = "*") {
		this.selectCols = columns;
		return this;
	}

	insert(data: unknown) {
		this.type = "insert";
		this.insertData = data;
		return this;
	}

	update(data: unknown) {
		this.type = "update";
		this.updateData = data;
		return this;
	}

	upsert(data: unknown) {
		this.type = "upsert";
		this.upsertData = data;
		return this;
	}

	delete() {
		this.type = "delete";
		return this;
	}

	eq(col: string, val: unknown) {
		this.filters.push({ col, op: "eq", val });
		return this;
	}

	is(col: string, val: unknown) {
		this.filters.push({ col, op: "is", val });
		return this;
	}

	in(col: string, vals: unknown[]) {
		this.filters.push({ col, op: "in", val: vals });
		return this;
	}

	order(col: string, options?: { ascending?: boolean }) {
		this.orderClauses.push({ col, ascending: options?.ascending !== false });
		return this;
	}

	limit(n: number) {
		this.limitVal = n;
		return this;
	}

	compile(): { text: string; params: unknown[] } {
		validateIdentifier(this.tableName);
		validateIdentifier(this.selectCols);

		const params: unknown[] = [];
		let text = "";

		const buildWhereClause = () => {
			if (this.filters.length === 0) return "";
			const conditions: string[] = [];
			for (const f of this.filters) {
				validateIdentifier(f.col);
				if (f.op === "eq") {
					params.push(f.val);
					conditions.push(`"${f.col}" = $${params.length}`);
				} else if (f.op === "is") {
					if (f.val === null) {
						conditions.push(`"${f.col}" IS NULL`);
					} else if (f.val === true) {
						conditions.push(`"${f.col}" IS TRUE`);
					} else if (f.val === false) {
						conditions.push(`"${f.col}" IS FALSE`);
					} else {
						params.push(f.val);
						conditions.push(`"${f.col}" IS $${params.length}`);
					}
				} else if (f.op === "in") {
					const vals = Array.isArray(f.val) ? f.val : [f.val];
					if (vals.length === 0) {
						conditions.push("1 = 0");
					} else {
						const placeholders = vals.map((v) => {
							params.push(v);
							return `$${params.length}`;
						});
						conditions.push(`"${f.col}" IN (${placeholders.join(", ")})`);
					}
				}
			}
			return ` WHERE ${conditions.join(" AND ")}`;
		};

		const buildOrderByClause = () => {
			if (this.orderClauses.length === 0) return "";
			const clauses = this.orderClauses.map((o) => {
				validateIdentifier(o.col);
				return `"${o.col}" ${o.ascending ? "ASC" : "DESC"}`;
			});
			return ` ORDER BY ${clauses.join(", ")}`;
		};

		const buildLimitClause = () => {
			if (this.limitVal === null) return "";
			return ` LIMIT ${Number(this.limitVal)}`;
		};

		if (this.type === "select") {
			text = `SELECT ${this.selectCols} FROM "${this.tableName}"`;
			text += buildWhereClause();
			text += buildOrderByClause();
			text += buildLimitClause();
		} else if (this.type === "insert") {
			const rawData = this.insertData;
			const data = Array.isArray(rawData) ? rawData : [rawData];
			if (data.length === 0) {
				throw new Error("Cannot insert empty array of rows");
			}
			const cols = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));
			cols.forEach(validateIdentifier);
			const valueRows: string[] = [];
			for (const obj of data) {
				const placeholders: string[] = [];
				for (const col of cols) {
					const val = obj[col];
					params.push(val !== undefined ? val : null);
					placeholders.push(`$${params.length}`);
				}
				valueRows.push(`(${placeholders.join(", ")})`);
			}
			const colsEscaped = cols.map((c) => `"${c}"`).join(", ");
			text = `INSERT INTO "${this.tableName}" (${colsEscaped}) VALUES ${valueRows.join(", ")} RETURNING ${this.selectCols}`;
		} else if (this.type === "update") {
			const rawData = this.updateData as any;
			const cols = Object.keys(rawData);
			if (cols.length === 0) {
				throw new Error("Cannot update with empty values");
			}
			cols.forEach(validateIdentifier);
			const setClauses = cols.map((c) => {
				params.push(rawData[c]);
				return `"${c}" = $${params.length}`;
			});
			text = `UPDATE "${this.tableName}" SET ${setClauses.join(", ")}`;
			text += buildWhereClause();
			text += ` RETURNING ${this.selectCols}`;
		} else if (this.type === "delete") {
			text = `DELETE FROM "${this.tableName}"`;
			text += buildWhereClause();
			text += ` RETURNING ${this.selectCols}`;
		} else if (this.type === "upsert") {
			const rawData = this.upsertData;
			const data = Array.isArray(rawData) ? rawData : [rawData];
			if (data.length === 0) {
				throw new Error("Cannot upsert empty array of rows");
			}
			const cols = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));
			cols.forEach(validateIdentifier);
			const valueRows: string[] = [];
			for (const obj of data) {
				const placeholders: string[] = [];
				for (const col of cols) {
					const val = obj[col];
					params.push(val !== undefined ? val : null);
					placeholders.push(`$${params.length}`);
				}
				valueRows.push(`(${placeholders.join(", ")})`);
			}
			const colsEscaped = cols.map((c) => `"${c}"`).join(", ");

			let conflictTarget = "id";
			if (this.tableName === "profiles") {
				conflictTarget = "user_id";
			} else if (this.tableName === "company_branding") {
				conflictTarget = "company_id";
			} else if (this.tableName === "tenant_feature_flags") {
				conflictTarget = "company_id, flag";
			}

			validateIdentifier(conflictTarget);

			const updateSet = cols
				.filter(
					(c) =>
						!conflictTarget
							.split(",")
							.map((s) => s.trim())
							.includes(c),
				)
				.map((c) => `"${c}" = EXCLUDED."${c}"`)
				.join(", ");

			const doUpdate = updateSet ? `DO UPDATE SET ${updateSet}` : "DO NOTHING";
			const conflictColsEscaped = conflictTarget
				.split(",")
				.map((s) => `"${s.trim()}"`)
				.join(", ");

			text = `INSERT INTO "${this.tableName}" (${colsEscaped}) VALUES ${valueRows.join(", ")} ON CONFLICT (${conflictColsEscaped}) ${doUpdate} RETURNING ${this.selectCols}`;
		}

		return { text, params };
	}

	private async injectVirtualRLS() {
		if (this.rlsInjected || !this.context) return;
		this.rlsInjected = true;

		const userIsolatedTables = [
			"projects",
			"skills",
			"prompts",
			"notifications",
			"profiles",
		];
		if (!userIsolatedTables.includes(this.tableName)) return;

		// 1. Get userId from session
		const token = getSessionToken(this.context);
		if (!token) return;
		const payload = await verifySession(token);
		if (!payload?.userId) return;

		// 2. Check if user_id filter is already explicitly present
		const hasUserIdFilter = this.filters.some((f) => f.col === "user_id");
		if (hasUserIdFilter) return;

		// 3. For profiles, always isolate by user_id
		if (this.tableName === "profiles") {
			this.filters.push({ col: "user_id", op: "eq", val: payload.userId });
			return;
		}

		// 4. For other tables (projects, skills, prompts, notifications):
		// Check if there is an explicit company_id filter (B2B flow)
		const hasCompanyIdFilter = this.filters.some(
			(f) => f.col === "company_id" && f.op === "eq" && f.val !== null,
		);

		// If it's B2C (no company_id, or company_id is null), force user_id filter!
		if (!hasCompanyIdFilter) {
			this.filters.push({ col: "user_id", op: "eq", val: payload.userId });
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: error object can be any database/PostgREST error payload
	async execute(): Promise<{ data: T[] | null; error: any | null }> {
		try {
			await this.injectVirtualRLS();
			const { text, params } = this.compile();
			// biome-ignore lint/suspicious/noExplicitAny: query returns typed row array
			const res = await query<any>(text, params);
			return { data: res.rows, error: null };
		} catch (err: unknown) {
			const errorPayload = err as { message?: string; code?: string };
			return {
				data: null,
				error: {
					message: errorPayload.message || "Database query failed",
					code: errorPayload.code || null,
				},
			};
		}
	}

	async single(): Promise<{ data: T | null; error: any | null }> {
		const { data, error } = await this.execute();
		if (error) return { data: null, error };
		if (!data || data.length === 0) {
			return {
				data: null,
				error: { message: "Row not found", code: "PGRST116" },
			};
		}
		return { data: data[0]!, error: null };
	}

	async maybeSingle(): Promise<{ data: T | null; error: any | null }> {
		const { data, error } = await this.execute();
		if (error) return { data: null, error };
		return { data: data && data.length > 0 ? data[0]! : null, error: null };
	}

	then<TResult1 = { data: T[] | null; error: any | null }, TResult2 = never>(
		onfulfilled?:
			| ((value: {
					data: T[] | null;
					error: any | null;
			  }) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}
}

export class NeonCompatClient {
	public auth: {
		getSession: () => Promise<{
			data: {
				session: {
					user: {
						id: string;
						email: string;
						role: string;
					};
					access_token: string;
					refresh_token: string;
					expires_in: number;
					expires_at: number;
				} | null;
			};
			error: any | null;
		}>;
		getUser: (jwt?: string) => Promise<{
			data: {
				user: {
					id: string;
					email: string;
					role: string;
				} | null;
			};
			error: any | null;
		}>;
	};

	constructor(private context: any) {
		this.auth = {
			getSession: async () => {
				const token = getSessionToken(this.context);
				if (!token) return { data: { session: null }, error: null };

				const payload = await verifySession(token);
				if (!payload) return { data: { session: null }, error: null };

				try {
					const res = await query(
						"SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1",
						[payload.userId],
					);
					const user = res.rows[0];
					if (!user) {
						return { data: { session: null }, error: null };
					}
					return {
						data: {
							session: {
								user: {
									id: user.id,
									email: user.email,
									role: payload.role || "authenticated",
								},
								access_token: token,
								refresh_token: "",
								expires_in: 60 * 60 * 24 * 7,
								expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
							},
						},
						error: null,
					};
				} catch (err: any) {
					return {
						data: { session: null },
						error: { message: err.message || "Failed to query session user" },
					};
				}
			},
			getUser: async (jwt?: string) => {
				const token = jwt || getSessionToken(this.context);
				if (!token) return { data: { user: null }, error: null };

				const payload = await verifySession(token);
				if (!payload) return { data: { user: null }, error: null };

				try {
					const res = await query(
						"SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1",
						[payload.userId],
					);
					const user = res.rows[0];
					if (!user) {
						return { data: { user: null }, error: null };
					}
					return {
						data: {
							user: {
								id: user.id,
								email: user.email,
								role: payload.role || "authenticated",
							},
						},
						error: null,
					};
				} catch (err: any) {
					return {
						data: { user: null },
						error: { message: err.message || "Failed to query user" },
					};
				}
			},
		};
	}

	from<T = any>(tableName: string): QueryBuilder<T> {
		return new QueryBuilder<T>(tableName, this.context);
	}
}
