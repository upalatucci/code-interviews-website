import type { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import { Resend } from 'resend';
import { NeonAdapter } from './neon-adapter';

export const authOptions: NextAuthOptions = {
  adapter: NeonAdapter(),

  providers: [
    EmailProvider({
      sendVerificationRequest: async ({ identifier: email, url }) => {
        // In dev: log the magic link so you can use it without an email service
        if (process.env.NODE_ENV !== 'production') {
          console.log('\n🔗 Magic link for', email, ':\n', url, '\n');
          return;
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.AUTH_EMAIL_FROM ?? 'noreply@example.com';

        await resend.emails.send({
          from,
          to: email,
          subject: 'Sign in to the Interview Platform',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#ee0000">Red Hat Interview Platform</h2>
              <p>Click the button below to sign in. This link expires in 24 hours.</p>
              <a href="${url}"
                 style="display:inline-block;background:#ee0000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;margin:16px 0">
                Sign in
              </a>
              <p style="color:#666;font-size:13px">Or copy this URL into your browser:<br/>${url}</p>
            </div>
          `,
        });
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/signin',
  },

  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

// Augment next-auth session type
declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
