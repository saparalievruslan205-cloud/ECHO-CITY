import { headers } from "next/headers";
import { EchoCityApp } from "./EchoCityApp";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { getRequestUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  let user = null;
  try {
    const requestHeaders = await headers();
    user = await getRequestUser(new Request("https://echo-city.local/", { headers: requestHeaders }));
  } catch {
    // Public map remains available even if identity or the database is unavailable.
  }
  return (
    <EchoCityApp
      signInPath={chatGPTSignInPath("/")}
      user={user ? { userId: user.id, email: user.email, displayName: user.displayName, role: user.role } : null}
    />
  );
}
