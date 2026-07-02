import type { QueryResult, QueryResultRow } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";

const databaseUrl =
	import.meta.env.DATABASE_URL ||
	(typeof process !== "undefined" ? process.env?.DATABASE_URL : undefined);
const isProd = import.meta.env.PROD;

if (!databaseUrl) {
	console.warn(
		"[Neon] DATABASE_URL is not configured. Queries will fail at runtime.",
	);
}

export const pool = new Pool({
	connectionString: databaseUrl,
});

/**
 * Execute a raw SQL query with the Neon database connection pool.
 * Properly manages client acquisition and release with structured logging
 * and production PII/sensitive data redaction.
 */
// biome-ignore lint/suspicious/noExplicitAny: Neon query results can be arbitrary objects
export const query = async <T extends QueryResultRow = any>(
	text: string,
	// biome-ignore lint/suspicious/noExplicitAny: SQL params can be any primitive/object value
	params?: any[],
): Promise<QueryResult<T>> => {
	if (!databaseUrl) {
		throw new Error(
			"[Neon] DATABASE_URL is not configured. Cannot execute queries.",
		);
	}

	const start = performance.now();
	try {
		const res = await pool.query<T>(text, params);
		const duration = (performance.now() - start).toFixed(2);

		console.log(`[Neon Query] Executed query in ${duration}ms`, {
			text,
			rows: res.rowCount,
			params: isProd ? "[REDACTED_PROD]" : params,
		});

		return res;
	} catch (error) {
		console.error("[Neon Query Error]", {
			text,
			params: isProd ? "[REDACTED_PROD]" : params,
			error:
				error instanceof Error
					? { message: error.message, stack: error.stack }
					: error,
		});
		throw error;
	}
};

/**
 * Execute multiple database operations inside a single secure ACID transaction.
 * Guarantees Atomicity, Consistency, Isolation, and Durability by executing
 * all queries on the same acquired connection client.
 */
export const transaction = async <T>(
	callback: (client: {
		// biome-ignore lint/suspicious/noExplicitAny: Neon query results can be arbitrary objects
		query: <R extends QueryResultRow = any>(
			text: string,
			// biome-ignore lint/suspicious/noExplicitAny: SQL params can be any primitive/object value
			params?: any[],
		) => Promise<QueryResult<R>>;
	}) => Promise<T>,
): Promise<T> => {
	if (!databaseUrl) {
		throw new Error(
			"[Neon] DATABASE_URL is not configured. Cannot execute transactions.",
		);
	}

	const client = await pool.connect();
	const start = performance.now();
	try {
		await client.query("BEGIN");

		// Wrap the client.query to include our custom query logging
		const wrappedClient = {
			// biome-ignore lint/suspicious/noExplicitAny: Neon query results can be arbitrary objects
			query: async <R extends QueryResultRow = any>(
				text: string,
				// biome-ignore lint/suspicious/noExplicitAny: SQL params can be any primitive/object value
				params?: any[],
			) => {
				const queryStart = performance.now();
				try {
					const res = await client.query<R>(text, params);
					const duration = (performance.now() - queryStart).toFixed(2);
					console.log(`[Neon Tx Query] Executed query in ${duration}ms`, {
						text,
						rows: res?.rowCount ?? 0,
						params: isProd ? "[REDACTED_PROD]" : params,
					});
					return res;
				} catch (err) {
					console.error("[Neon Tx Query Error]", {
						text,
						params: isProd ? "[REDACTED_PROD]" : params,
						error: err instanceof Error ? err.message : err,
					});
					throw err;
				}
			},
		};

		const result = await callback(wrappedClient);
		await client.query("COMMIT");

		const duration = (performance.now() - start).toFixed(2);
		console.log(
			`[Neon Tx Success] Transaction committed successfully in ${duration}ms`,
		);
		return result;
	} catch (error) {
		try {
			await client.query("ROLLBACK");
		} catch (rollbackError) {
			console.error(
				"[Neon Tx] ROLLBACK failed (swallowed — original error follows):",
				rollbackError,
			);
		}
		console.error(
			"[Neon Tx Rollback] Transaction rolled back due to error:",
			error,
		);
		throw error;
	} finally {
		client.release();
	}
};
