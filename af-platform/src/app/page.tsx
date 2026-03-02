import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  const cookieStore = cookies();
  const session = cookieStore.get("af-session");
  redirect(session ? "/dashboard" : "/login");
}
