import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Minimal scopes: `read:user` for profile, `repo` for reading pull request
// diffs (private repos need it; GitHub has no read-only PR-diff scope).
const GITHUB_SCOPE = "read:user repo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      authorization: { params: { scope: GITHUB_SCOPE } },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

/**
 * Looks up the caller's GitHub access token from the Account table.
 * Never sent to the client — only used for server-side GitHub API calls.
 */
export async function getGithubAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  return account?.access_token ?? null;
}
