export type CompanyProfile = {
  companyName: string;
  hasLogo: boolean;
  logoDataUrl: string | null;
};

export type CompanyError =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'cancelled'
  | 'import_failed';

export type CompanyProfileResult =
  | { ok: true; profile: CompanyProfile }
  | { ok: false; error: CompanyError };
