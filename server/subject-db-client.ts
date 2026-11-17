import { pool } from "./db";

type SubjectQueryResult = { rows: Record<string, any>[]; rowCount: number | null };
type SubjectDbClient = {
 query(sql: string, values?: unknown[]): Promise<SubjectQueryResult>;
 release(): void;
};

// Both configured drivers implement the promise-based text query API.
// Narrow only this boundary, not the application's global pool type.
export async function connectSubjectDb(): Promise<SubjectDbClient> {
 const client = await pool.connect();
 const query = client.query.bind(client) as unknown as SubjectDbClient["query"];
 return { query, release: () => client.release() };
}
