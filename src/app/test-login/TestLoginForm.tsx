"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function TestLoginForm() {
  const [email, setEmail] = useState("e2e-test@example.com");
  const [name, setName]   = useState("E2Eテストユーザー");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn("e2e-credentials", { email, name, callbackUrl: "/dashboard" });
  };

  return (
    <form onSubmit={handleSubmit} data-testid="test-login-form">
      <input
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        data-testid="test-email"
      />
      <input
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="test-name"
      />
      <button type="submit" data-testid="test-submit">
        テストログイン
      </button>
    </form>
  );
}
