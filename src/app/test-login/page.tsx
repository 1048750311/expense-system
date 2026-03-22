// E2Eテスト専用ログインページ
// E2E_TEST=true のときのみアクセス可能
import { notFound } from "next/navigation";
import TestLoginForm from "./TestLoginForm";

export default function TestLoginPage() {
  if (process.env.E2E_TEST !== "true") {
    notFound();
  }
  return <TestLoginForm />;
}
