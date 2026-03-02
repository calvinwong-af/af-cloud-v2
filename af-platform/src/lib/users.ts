// TODO: AFC/AFU naming convention is counterintuitive (AFC=Customer, AFU=Staff)
// Review and revise when building the new webserver. Propose cleaner naming
// (e.g. INTERNAL/CUSTOMER) with a coordinated Datastore migration.

import { cookies } from 'next/headers';

export interface UserRecord {
  uid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  account_type: string;
  created_at: string | null;
  validated: boolean;
  valid_access: boolean;
  last_login: string | null;
  company_id: string | null;
  company_name: string | null;
  role: string;
}

export async function getUsers(): Promise<UserRecord[]> {
  try {
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return [];

    const url = new URL('/api/v2/users', process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const json = await res.json();
    return (json.data ?? []) as UserRecord[];
  } catch {
    return [];
  }
}
