import axios from 'axios';
import { API_BASE_URL } from './api';

const client = axios.create({ baseURL: API_BASE_URL });

export interface PublicFormConfig {
  title: string;
  description: string | null;
  fields: Array<{
    id: number;
    label: string;
    field_key: string;
    field_type: string;
    is_required: boolean;
    options: string[] | null;
    placeholder: string | null;
    order_index: number;
  }>;
  job_options: Array<{ id: number; title: string; department: string }>;
}

export function shortLinkHeaders(shortCode: string, routePrefix: string) {
  return {
    'X-Short-Code': shortCode,
    'X-Route-Prefix': routePrefix,
  };
}

export async function fetchPublicForm(shortCode: string) {
  const res = await client.get(`/public/form/${shortCode}`);
  return res.data.data as PublicFormConfig;
}

export async function checkExistingApplication(
  shortCode: string,
  routePrefix: string,
  fields: Record<string, unknown>
) {
  const res = await client.post(
    '/public/application/check',
    { shortCode, routePrefix, fields },
    { headers: shortLinkHeaders(shortCode, routePrefix) }
  );
  return res.data;
}

export async function resumeApplication(
  shortCode: string,
  routePrefix: string,
  fields: Record<string, unknown>,
  sessionToken?: string
) {
  const res = await client.post(
    '/public/application/resume',
    { shortCode, routePrefix, fields, sessionToken },
    { headers: shortLinkHeaders(shortCode, routePrefix) }
  );
  return res.data;
}

export async function saveDraft(
  shortCode: string,
  routePrefix: string,
  fields: Record<string, unknown>,
  sessionToken: string
) {
  const res = await client.post(
    '/public/application/save-draft',
    { shortCode, routePrefix, fields },
    {
      headers: {
        ...shortLinkHeaders(shortCode, routePrefix),
        'X-Session-Token': sessionToken,
      },
    }
  );
  return res.data;
}

export async function submitApplication(
  shortCode: string,
  routePrefix: string,
  formData: FormData,
  action: 'new' | 'update' | 'fresh' | 'continue' = 'new'
) {
  formData.append('shortCode', shortCode);
  formData.append('routePrefix', routePrefix);
  formData.append('action', action);
  const res = await client.post('/public/application/submit', formData, {
    headers: {
      ...shortLinkHeaders(shortCode, routePrefix),
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export const SESSION_STORAGE_KEY = 'hr_public_application_session';

export async function resolveLegacyShareLink(slug: string, shareToken: string) {
  const res = await client.get('/public/legacy-resolve', {
    params: { slug, share: shareToken },
  });
  return res.data as {
    success: boolean;
    redirectPath: string;
    url: string;
    shortCode: string;
    routePrefix: string;
  };
}

export async function checkLegacyDuplicate(
  slug: string,
  authQuery: string,
  fields: Record<string, unknown>
) {
  const res = await client.post(`/public/forms/${slug}/check?${authQuery}`, { fields });
  return res.data;
}

export async function submitLegacyApplication(
  slug: string,
  authQuery: string,
  formData: FormData,
  action: 'new' | 'update' | 'fresh' | 'continue' = 'new'
) {
  formData.append('action', action);
  const res = await client.post(`/public/forms/${slug}/submit?${authQuery}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
