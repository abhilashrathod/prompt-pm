import "server-only";
import { cookies } from "next/headers";
import { USER_COOKIE, resolveCurrentUser } from "@/lib/domain/currentUser";

export async function getCurrentUser() {
  return resolveCurrentUser((await cookies()).get(USER_COOKIE)?.value);
}
