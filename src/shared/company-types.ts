export type CompanyProfile = {
  name: string;
  address: string;
  contact: string;
  notes: string;
  logoDataUrl: string | null;
};

export type CompanyBranding = {
  name: string;
  logoDataUrl: string | null;
};

export type CompanyResult =
  | { ok: true; profile: CompanyProfile }
  | { ok: false; error: string };

export type CompanyBrandingResult =
  | { ok: true; branding: CompanyBranding }
  | { ok: false; error: string };

export type CompanyLogoResult =
  | { ok: true; profile: CompanyProfile; cancelled?: boolean }
  | { ok: false; error: string };
