export type CompanyProfile = {
  name: string;
  address: string;
  contact: string;
  notes: string;
};

export type CompanyResult =
  | { ok: true; profile: CompanyProfile }
  | { ok: false; error: string };
