"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeResetAction } from "@/lib/server/actions";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="mx-auto mt-24 w-full max-w-md space-y-4 px-6"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await completeResetAction(token, password);
        if (result?.error) setError(result.error);
      }}
    >
      <h1 className="text-2xl font-semibold text-navy">Choose a new password</h1>
      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit">Update password</Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
