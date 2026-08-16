"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteAccountForm({ email }: { email: string }) {
  const [confirm, setConfirm] = useState("");
  const [state, formAction, pending] = useActionState(deleteAccount, {});
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This permanently deletes your account, every spot you own,
          preferences, and sessions. Other devices are signed out.
        </p>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="deleteEmail">Type {email} to confirm</Label>
            <Input
              id="deleteEmail"
              name="email"
              type="email"
              required
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deletePassword">Password</Label>
            <Input
              id="deletePassword"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            variant="destructive"
            disabled={!matches || pending}
          >
            {pending ? "Deleting…" : "Delete my account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
