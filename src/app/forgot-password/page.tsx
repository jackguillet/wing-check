"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (resetError) {
      setError(resetError.message ?? "Couldn't send reset email");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            We&apos;ll email you a link to choose a new password.
          </CardDescription>
        </CardHeader>
        {sent ? (
          <CardContent className="space-y-4">
            <p className="text-sm">
              If an account exists for {email}, a reset link is on its way.
            </p>
            <Link href="/sign-in" className="text-sm text-primary underline">
              Back to sign in
            </Link>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <Link href="/sign-in" className="text-sm text-primary underline">
                Back to sign in
              </Link>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
