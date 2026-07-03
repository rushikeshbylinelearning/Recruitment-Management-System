/**
 * Normalize public form field keys to canonical names used by the submission pipeline.
 */
export const FIELD_KEY_ALIASES = {
  full_name: 'name',
  candidate_name: 'name',
  applicant_name: 'name',
  email_id: 'email',
  email_address: 'email',
  emailid: 'email',
  phone_number: 'phone',
  mobile_number: 'phone',
  contact_number: 'phone',
  mobile: 'phone',
  contact: 'phone',
  postion: 'position',
  job_title: 'position',
  role: 'position',
  designation: 'position',
  job_role: 'position',
  profile: 'position',
  position_applied: 'position',
  applied_position: 'position',
  years_of_experience: 'experience',
  years_experience: 'experience',
  experience_in_years: 'experience',
  exp: 'experience',
  work_experience: 'experience',
  total_experience: 'experience',
  notice_period_days: 'notice_period',
  notice_period_in_days: 'notice_period',
  expected_salary: 'expected_ctc',
  referral_source: 'source',
  application_source: 'source',
  current_location: 'location',
  city: 'location',
  current_city: 'location',
  linkedin: 'linkedin_url',
  linkedin_profile: 'linkedin_url',
  linkedin_url: 'linkedin_url',
};

export function normalizeFormData(formData = {}) {
  const normalized = { ...formData };
  for (const [key, value] of Object.entries(formData)) {
    const canonical = FIELD_KEY_ALIASES[key.toLowerCase()];
    if (canonical && normalized[canonical] === undefined) {
      normalized[canonical] = value;
    }
  }
  return normalized;
}

export function extractContactFields(normalized) {
  return {
    email: normalized.email ? String(normalized.email).trim().toLowerCase() : null,
    phone: normalized.phone ? String(normalized.phone).replace(/\D/g, '') : null,
    linkedinUrl: normalized.linkedin_url
      ? String(normalized.linkedin_url).trim()
      : null,
    name: normalized.name ? String(normalized.name).trim() : null,
  };
}
