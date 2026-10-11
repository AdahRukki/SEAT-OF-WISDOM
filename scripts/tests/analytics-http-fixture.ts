// Production reporting routes and JWT middleware over an isolated database.
// This does not initialize the production server, database or background jobs.
import fs from 'node:fs';
import ts from 'typescript';
import express from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { registerAnalyticsRoutes } from '../../server/analytics-routes';
import { actor, ids, type createAnalyticsFixture } from './analytics-database-fixture';

export async function createAnalyticsHttpFixture(f: Awaited<ReturnType<typeof createAnalyticsFixture>>) {
  const secret = 'isolated-general-school-acceptance-secret';
  const invalidatedTokens = new Set<string>();
  const source = fs.readFileSync(new URL('../../server/routes.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true);
  const names = ['authenticate', 'requireMainAdmin'];
  const declarations = ast.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.includes(d.name.getText(ast))));
  const emitted = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const lookup = async (id: string) => (await f.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1))[0];
  const { authenticate, requireMainAdmin } = new Function('jwt', 'storage', 'invalidatedTokens', 'JWT_SECRET', emitted + ';return {authenticate,requireMainAdmin};')(jwt, { getUserById: lookup }, invalidatedTokens, secret);
  const accounts: Record<string, string> = { admin: actor };
  for (const role of ['sub-admin', 'bursar', 'student']) {
    const [user] = await f.db.insert(schema.users).values({ email: `${role}@acceptance.test`, password: 'fixture-only', firstName: 'Test', lastName: role, role, schoolId: ids[0] }).returning();
    accounts[role] = user.id;
  }
  // Model existing accounts: JWT iat has second precision, whereas newly
  // inserted password timestamps have milliseconds. These accounts predate login.
  for (const id of Object.values(accounts)) await f.pg.query("UPDATE users SET password_updated_at=now()-interval '1 hour' WHERE id=$1", [id]);
  const tokens = Object.fromEntries(Object.entries(accounts).map(([role, userId]) => [role, jwt.sign({ userId }, secret, { expiresIn: '1h' })]));
  const app = express();
  registerAnalyticsRoutes(app, authenticate, requireMainAdmin, f.reporting);
  app.get('/api/auth/me', authenticate, (req, res) => { const { password, passwordUpdatedAt, ...user } = (req as any).user; res.json(user); });
  app.get('/api/admin/schools', authenticate, requireMainAdmin, async (_req, res) => res.json((await f.db.select().from(schema.schools))));
  app.get('/api/logo', (_req, res) => res.json({ logoUrl: '/academy-logo.png' }));
  app.get('/api/current-academic-info', authenticate, async (_req, res) => { const school = (await f.db.select().from(schema.schools))[0]; res.json({ currentTerm: school.currentTerm, currentSession: school.currentSession }); });
  // Unrelated auth-prefetch helpers are minimal fixtures. Reporting calls above
  // always execute the real database service and actual authorization middleware.
  app.get('/api/*', authenticate, (_req, res) => res.json([]));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = (path: string, role?: string) => fetch(`${origin}/api/admin/analytics/${path}`, { headers: role ? { Authorization: `Bearer ${tokens[role]}` } : {} });
  const close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return { origin, tokens, accounts, invalidatedTokens, request, close };
}
