"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const publicLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/spots", label: "Spots" },
];

const authLinks = [{ href: "/settings", label: "Settings" }];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);

  const isAuthenticated = !!session?.user;
  const visibleLinks = isAuthenticated
    ? [...publicLinks, ...authLinks]
    : publicLinks;

  async function handleSignOut() {
    await authClient.signOut();
    setOpen(false);
    router.push("/sign-in");
    router.refresh();
  }

  const linkClass = (href: string) =>
    cn(
      "text-sm font-medium transition-colors hover:text-primary",
      pathname === href ? "text-foreground" : "text-muted-foreground",
    );

  const authButtons = isPending ? null : isAuthenticated ? (
    <>
      <span className="text-sm text-muted-foreground truncate max-w-[10rem]">
        {session.user.name || session.user.email}
      </span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign Out
      </Button>
    </>
  ) : (
    <>
      <Link href="/sign-in" onClick={() => setOpen(false)}>
        <Button variant="outline" size="sm">
          Sign In
        </Button>
      </Link>
      <Link href="/sign-up" onClick={() => setOpen(false)}>
        <Button size="sm">Sign Up</Button>
      </Link>
    </>
  );

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href="/" className="mr-4 flex items-center space-x-2 shrink-0">
          <span className="text-xl font-bold">Wing Check</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden md:flex items-center space-x-4">
          {authButtons}
        </div>

        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Open menu"
                className="size-11"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Wing Check</SheetTitle>
                <SheetDescription className="sr-only">
                  Site navigation
                </SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(linkClass(link.href), "py-2")}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex flex-col gap-2 pt-2">{authButtons}</div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
