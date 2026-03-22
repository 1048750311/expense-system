import Dashboard from "@/components/Dashboard";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Bridge System - 精算一覧",
  description: "支出管理システム - 精算一覧",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return <Dashboard />;
}