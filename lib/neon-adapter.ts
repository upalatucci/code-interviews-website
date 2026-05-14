/**
 * Minimal NextAuth v4 database adapter backed by Neon.
 * Supports: email magic-link flow with JWT sessions.
 * Only implements the methods required for that flow.
 */
import type { Adapter } from 'next-auth/adapters';
import { sql, ensureSchema } from './db';

interface DBUser {
  id: string;
  name: string | null;
  email: string;
  email_verified: string | null;
  image: string | null;
}

function mapUser(u: DBUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.email_verified ? new Date(u.email_verified) : null,
    image: u.image,
  };
}

export function NeonAdapter(): Adapter {
  return {
    async createUser(user: { email: string; name?: string | null; emailVerified?: Date | null; image?: string | null }) {
      await ensureSchema();
      const { rows } = await sql`
        INSERT INTO auth_users (email, name, email_verified, image)
        VALUES (${user.email}, ${user.name ?? null}, ${user.emailVerified?.toISOString() ?? null}, ${user.image ?? null})
        RETURNING *
      `;
      return mapUser(rows[0] as DBUser);
    },

    async getUser(id) {
      await ensureSchema();
      const { rows } = await sql`SELECT * FROM auth_users WHERE id = ${id}`;
      return rows.length ? mapUser(rows[0] as DBUser) : null;
    },

    async getUserByEmail(email) {
      await ensureSchema();
      const { rows } = await sql`SELECT * FROM auth_users WHERE email = ${email}`;
      return rows.length ? mapUser(rows[0] as DBUser) : null;
    },

    async updateUser(user) {
      await ensureSchema();
      const { rows } = await sql`
        UPDATE auth_users
        SET name = ${user.name ?? null},
            email_verified = ${user.emailVerified?.toISOString() ?? null}
        WHERE id = ${user.id}
        RETURNING *
      `;
      return mapUser(rows[0] as DBUser);
    },

    async createVerificationToken({ identifier, expires, token }) {
      await ensureSchema();
      await sql`
        INSERT INTO auth_verification_tokens (identifier, token, expires)
        VALUES (${identifier}, ${token}, ${expires.toISOString()})
        ON CONFLICT (identifier, token)
        DO UPDATE SET expires = EXCLUDED.expires
      `;
      return { identifier, token, expires };
    },

    async useVerificationToken({ identifier, token }) {
      await ensureSchema();
      const { rows } = await sql`
        DELETE FROM auth_verification_tokens
        WHERE identifier = ${identifier} AND token = ${token}
        RETURNING *
      `;
      if (!rows.length) return null;
      const r = rows[0] as { identifier: string; token: string; expires: string };
      return { identifier: r.identifier, token: r.token, expires: new Date(r.expires) };
    },

    // Unused stubs — required by Adapter interface but not called with JWT sessions
    async getUserByAccount() { return null; },
    async linkAccount() { return undefined; },
    async createSession(s) { return s; },
    async getSessionAndUser() { return null; },
    async updateSession() { return null; },
    async deleteSession() {},
    async deleteUser() {},
    async unlinkAccount() {},
  };
}
