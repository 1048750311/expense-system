import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
    }),
    // E2Eテスト専用: E2E_TEST=true のときのみ有効
    ...(process.env.E2E_TEST === "true"
      ? [
          CredentialsProvider({
            id: "e2e-credentials",
            name: "E2E Test Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;
              const user = await prisma.user.upsert({
                where: { email: credentials.email },
                update: { name: credentials.name || "E2E Test User" },
                create: {
                  email: credentials.email,
                  name: credentials.name || "E2E Test User",
                },
              });
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.name = profile.name;
        token.email = profile.email;

        // Azure ADのOIDをazureIdとして保存（Azure AD固有プロパティ）
        const azureProfile = profile as Record<string, unknown>;
        const oid = azureProfile.oid as string | undefined;
        if (oid) {
          token.azureId = oid;
        }

        // DBからユーザー情報を取得または作成
        const dbUser = await prisma.user.upsert({
          where: { email: profile.email || "" },
          update: {
            name: profile.name || "",
            azureId: oid || (token.azureId as string | undefined),
          },
          create: {
            email: profile.email || "",
            name: profile.name || "",
            azureId: oid || (token.azureId as string | undefined),
          },
        });

        token.id = dbUser.id;

        // Azure AD プロフィール画像を取得してトークンに保存
        if (account?.access_token) {
          try {
            const photoRes = await fetch(
              "https://graph.microsoft.com/v1.0/me/photo/$value",
              { headers: { Authorization: `Bearer ${account.access_token}` } }
            );
            if (photoRes.ok) {
              const buffer = await photoRes.arrayBuffer();
              const base64 = Buffer.from(buffer).toString("base64");
              const mime = photoRes.headers.get("content-type") ?? "image/jpeg";
              token.image = `data:${mime};base64,${base64}`;
            }
          } catch {
            // 画像取得失敗は無視
          }
        }
      }
      // E2Eテスト用 CredentialsProvider（profileはなくuserが渡る）
      if (user && account?.provider === "e2e-credentials") {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = session.user.name || (token.name as string | undefined);
        session.user.image = (token.image as string | undefined) ?? session.user.image;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};
