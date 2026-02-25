import { getCollection } from "./datastore";

export interface UserAccountRaw {
  uid: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  account_type?: string;
  created_at?: string;
  validated?: boolean;
}

export interface UserIAMRaw {
  uid: string;
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
    getCollection<UserAccountRaw>("UserAccount"),
    getCollection<UserIAMRaw>("UserIAM"),
    getCollection<CompanyUserAccountRaw>("CompanyUserAccount"),
  ]);

  const iamMap = new Map(iamList.map((r) => [r.uid, r]));
  const companyMap = new Map(companyUsers.map((r) => [r.uid, r]));

  const merged: UserRecord[] = accounts.map((acct) => {
    const iam = iamMap.get(acct.uid);
    const company = companyMap.get(acct.uid);

    return {
      uid: acct.uid,
      first_name: acct.first_name ?? "",
      last_name: acct.last_name ?? "",
      email: acct.email ?? "",
      phone_number: acct.phone_number ?? null,
      account_type: acct.account_type ?? "AFU",
      created_at: acct.created_at ?? null,
      validated: acct.validated ?? false,
      valid_access: iam?.valid_access ?? false,
      last_login: iam?.last_login ?? null,
      company_id: company?.company_id ?? null,
      role: company?.role ?? "unknown",
    };
  });

  merged.sort((a, b) => {
    if (a.account_type === "AFC" && b.account_type !== "AFC") return -1;
    if (a.account_type !== "AFC" && b.account_type === "AFC") return 1;
    return a.last_name.localeCompare(b.last_name);
  });

  return merged;
}
