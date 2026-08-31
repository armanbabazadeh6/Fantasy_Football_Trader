import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { authEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  if (!authEnabled()) {
    redirect("/");
  }
  const params = await searchParams;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
    ? nextRaw
    : "/";
  return <LoginForm next={next} />;
}
