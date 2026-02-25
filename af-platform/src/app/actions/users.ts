"use server";

import { getUsers, type UserRecord } from "@/lib/users";

export async function fetchUsersAction(): Promise<UserRecord[]> {
  return getUsers();
}
