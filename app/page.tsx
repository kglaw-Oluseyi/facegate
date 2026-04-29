import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "PLATFORM_ADMIN") {
      redirect("/dashboard");
    }
    redirect("/staff/select-event");
  }
  redirect("/login");
}
