// TODO: AFC/AFU naming convention is counterintuitive (AFC=Customer, AFU=Staff)
// Review and revise when building the new webserver. Propose cleaner naming
// (e.g. INTERNAL/CUSTOMER) with a coordinated Datastore migration.

// TODO: Add pagination support when user count grows significantly.
// Current approach fetches all 327 records at once — acceptable for now.
// Consider cursor-based pagination with Datastore query cursors when count exceeds ~1000.

import { getKind } from "./datastore";

export interface UserAccountRaw {
  uid: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  account_type?: string;
  created_at?: string;
  email_validated?: boolean;
}

export interface UserIAMRaw {
  uid: string;
  role?: string;
  valid_access?: boolean;
  last_login?: string;
}

export interface CompanyUserAccountRaw {
  uid: string;
  company_id?: string | null;
  role?: string;
}

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
  role: string;
}

export async function getUsers(): Promise<UserRecord[]> {
  const [accounts, iamList, companyUsers] = await Promise.all([
    getKind<UserAccountRaw>("UserAccount"),
    getKind<UserIAMRaw>("UserIAM"),
    getKind<CompanyUserAccountRaw>("CompanyUserAccount"),
  ]);

  // Deduplicate UserAccount by email — AFU (staff) takes priority over AFC (customer)
  const acctByEmail = new Map<string, UserAccountRaw>();
  for (const acct of accounts) {
    const email = acct.email ?? "";
    const existing = acctByEmail.get(email);
    if (!existing || (acct.account_type === "AFU" && existing.account_type !== "AFU")) {
      acctByEmail.set(email, acct);
    }
  }
  const uniqueAccounts = Array.from(acctByEmail.values());

  const iamMap = new Map(iamList.map((r) => [r.uid, r]));
  const companyMap = new Map(companyUsers.map((r) => [r.uid, r]));

  const merged: UserRecord[] = uniqueAccounts.map((acct) => {
    const iam = iamMap.get(acct.uid);
    const company = companyMap.get(acct.uid);

    return {
      uid: acct.uid,
      first_name: acct.first_name ?? "",
      last_name: acct.last_name ?? "",
      email: acct.email ?? "",
      phone_number: acct.phone_number ?? null,
      account_type: acct.account_type ?? "AFC",
      created_at: acct.created_at ?? (acct as unknown as Record<string, string>).created ?? null,
      validated: acct.email_validated ?? false,
      valid_access: (iam?.valid_access ?? false) && (acct.email_validated ?? false),
      last_login: iam?.last_login ?? null,
      company_id: company?.company_id ?? null,
      role: iam?.role ?? "unknown",
    };
  });

  // Sort: AFU (staff) first, then AFC (customers), then alphabetical by last name
  merged.sort((a, b) => {
    if (a.account_type === "AFU" && b.account_type !== "AFU") return -1;
    if (a.account_type !== "AFU" && b.account_type === "AFU") return 1;
    return a.last_name.localeCompare(b.last_name);
  });

  return merged;
}
