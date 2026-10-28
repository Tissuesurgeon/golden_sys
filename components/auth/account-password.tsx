"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/server/teacher";

export function AccountPassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await changePassword(current, next);
        setPending(false);
        setMessage(result.error || "Password changed.");
        if (!result.error) {
          setCurrent("");
          setNext("");
        }
      }}
    >
      <label className="block space-y-1.5 text-sm">
        <span>Current password</span>
        <Input type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span>New password</span>
        <Input type="password" autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} required minLength={8} />
      </label>
      <Button type="submit" disabled={pending}>Change password</Button>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
    </form>
  );
}
