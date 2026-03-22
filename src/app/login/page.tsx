import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Bridge System - ログイン",
  description: "Bridge Systemへのログイン",
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
