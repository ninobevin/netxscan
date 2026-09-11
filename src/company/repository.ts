import { getDb } from '../db/client';
import type { CompanyProfile } from '../shared/company-types';

function mapProfile(row: {
  name: string;
  address: string;
  contact: string;
  notes: string;
}): CompanyProfile {
  return {
    name: row.name,
    address: row.address,
    contact: row.contact,
    notes: row.notes,
  };
}

export function getCompanyProfile(): CompanyProfile {
  const row = getDb()
    .prepare('SELECT name, address, contact, notes FROM company_profile WHERE id = 1')
    .get() as
    | { name: string; address: string; contact: string; notes: string }
    | undefined;
  if (!row) {
    return { name: '', address: '', contact: '', notes: '' };
  }
  return mapProfile(row);
}

export function updateCompanyProfile(input: CompanyProfile): CompanyProfile {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE company_profile
       SET name = ?, address = ?, contact = ?, notes = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(input.name.trim(), input.address.trim(), input.contact.trim(), input.notes.trim(), now);
  return getCompanyProfile();
}
