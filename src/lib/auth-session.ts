import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function getSessionFromHeaders(headerStore: Headers) {
  return auth.api.getSession({ headers: headerStore });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    const pathname = (await headers()).get("x-pathname");
    const dest =
      pathname &&
      pathname.startsWith("/") &&
      !pathname.startsWith("//") &&
      pathname !== "/sign-in"
        ? `/sign-in?callbackUrl=${encodeURIComponent(pathname)}`
        : "/sign-in";
    redirect(dest);
  }
  return session;
}
