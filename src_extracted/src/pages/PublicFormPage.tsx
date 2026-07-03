import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

interface FormField {
  id: number;
  label: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  options: string[] | null;
  placeholder: string | null;
  order_index: number;
}

interface FormData {
  form: {
    id: number;
    name: string;
    description: string;
    job_title: string | null;
  };
  fields: FormField[];
}

/* ─── Global Styles ─── */
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:              #F7F7F5;
    --surface:         #FFFFFF;
    --border:          #E4E4E0;
    --border-hover:    #C0C0BB;
    --border-focus:    #1A1A1A;
    --border-error:    #C0392B;
    --border-ok:       #27AE60;
    --text-primary:    #111110;
    --text-secondary:  #6B6B63;
    --text-placeholder:#AEAEAD;
    --accent:          #dc2626;
    --accent-light:    #fee2e2;
    --error:           #C0392B;
    --error-bg:        #FDF2F2;
    --success:         #1E7E41;
    --success-bg:      #EDF7F1;
    --radius-sm:       6px;
    --radius-md:       10px;
    --radius-lg:       16px;
    --shadow:          0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06);
    --font:            'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-display:    'Instrument Serif', Georgia, serif;
    --ease:            150ms ease;
  }

  body {
    background: var(--bg);
    font-family: var(--font);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
  }

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes popIn  { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }

  /* PAGE */
  .pf-page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    justify-content: center;
    padding: 0 20px 80px;
  }

  /* TWO-COLUMN LAYOUT */
  .pf-layout {
    width: 100%;
    max-width: 1000px;
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 48px;
    align-items: start;
    padding-top: 60px;
    animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* SIDEBAR */
  .pf-sidebar {
    position: sticky;
    top: 48px;
  }

  .pf-sidebar-logo {
    width: 38px; height: 38px;
    background: var(--text-primary);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 24px;
  }

  .pf-sidebar-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--text-placeholder);
    margin-bottom: 8px;
  }

  .pf-sidebar-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 400;
    line-height: 1.2;
    color: var(--text-primary);
    letter-spacing: -0.4px;
    margin-bottom: 12px;
  }
  .pf-sidebar-title em {
    font-style: italic;
    color: var(--text-secondary);
  }

  .pf-sidebar-desc {
    font-size: 13.5px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 24px;
  }

  .pf-sidebar-meta {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }
  .pf-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }
  .pf-meta-row svg { flex-shrink: 0; opacity: 0.65; }

  .pf-progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 7px;
  }
  .pf-progress-pct { font-weight: 600; }
  .pf-progress-track {
    height: 3px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }
  .pf-progress-fill {
    height: 100%;
    background: var(--text-primary);
    border-radius: 99px;
    transition: width 0.5s cubic-bezier(0.22,1,0.36,1);
  }

  /* FORM CARD */
  .pf-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .pf-card-header {
    padding: 26px 32px 22px;
    border-bottom: 1px solid var(--border);
    background: #FAFAF8;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pf-card-header-left { }
  .pf-card-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-placeholder);
    margin-bottom: 3px;
  }
  .pf-card-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }
  .pf-card-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    background: var(--accent-light);
    border: 1px solid rgba(0,87,255,0.15);
    border-radius: 99px;
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    white-space: nowrap;
  }

  /* FORM BODY */
  .pf-form-body { padding: 30px 32px 32px; }

  /* SECTION */
  .pf-section {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 30px 0 16px;
  }
  .pf-section:first-child { margin-top: 0; }
  .pf-section-pill {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-secondary);
    background: #F2F2EE;
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 3px 10px;
    white-space: nowrap;
  }
  .pf-section-line {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* FIELD */
  .pf-field { margin-bottom: 14px; }

  .pf-label {
    display: flex;
    align-items: baseline;
    gap: 5px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 6px;
    letter-spacing: -0.05px;
  }
  .pf-req { color: var(--error); font-size: 13px; }
  .pf-opt { font-size: 11px; color: var(--text-placeholder); font-weight: 400; }

  /* INPUT / TEXTAREA */
  .pf-input, .pf-textarea {
    width: 100%;
    font-family: var(--font);
    font-size: 14px;
    color: var(--text-primary);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color var(--ease), box-shadow var(--ease);
    -webkit-appearance: none;
  }
  .pf-input::placeholder, .pf-textarea::placeholder {
    color: var(--text-placeholder);
    font-weight: 400;
  }
  .pf-input  { height: 42px; padding: 0 13px; }
  .pf-textarea { min-height: 96px; padding: 11px 13px; resize: vertical; line-height: 1.55; }

  .pf-input:hover:not(:focus),
  .pf-textarea:hover:not(:focus) { border-color: var(--border-hover); }

  .pf-input:focus, .pf-textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
  }
  .pf-input.err, .pf-textarea.err {
    border-color: var(--border-error);
    box-shadow: 0 0 0 3px rgba(192,57,43,0.08);
  }
  .pf-input.ok { border-color: var(--border-ok); }

  /* TWO-COL GRID for paired fields */
  .pf-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* CUSTOM SELECT */
  .pf-sel-wrap { position: relative; }
  .pf-sel-btn {
    width: 100%; height: 42px;
    padding: 0 38px 0 13px;
    font-family: var(--font); font-size: 14px;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer; text-align: left;
    display: flex; align-items: center;
    outline: none;
    transition: border-color var(--ease), box-shadow var(--ease);
  }
  .pf-sel-btn:hover { border-color: var(--border-hover); }
  .pf-sel-btn.open  { border-color: var(--border-focus); box-shadow: 0 0 0 3px rgba(0,0,0,0.06); }
  .pf-sel-btn.err   { border-color: var(--border-error); }
  .pf-sel-icon {
    position: absolute; right: 11px; top: 50%;
    transform: translateY(-50%);
    pointer-events: none; color: var(--text-secondary);
    transition: transform var(--ease);
  }
  .pf-sel-icon.open { transform: translateY(-50%) rotate(180deg); }

  .pf-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    z-index: 200;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 6px rgba(0,0,0,0.04), 0 12px 30px rgba(0,0,0,0.09);
    max-height: 220px; overflow-y: auto;
    padding: 4px;
    list-style: none;
    animation: popIn 0.12s ease both;
  }
  .pf-dropdown::-webkit-scrollbar { width: 4px; }
  .pf-dropdown::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .pf-opt-item {
    padding: 9px 10px;
    border-radius: var(--radius-sm);
    font-size: 14px; font-family: var(--font);
    color: var(--text-primary);
    cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
    transition: background var(--ease);
    user-select: none;
  }
  .pf-opt-item:hover         { background: #F5F5F2; }
  .pf-opt-item.sel           { background: var(--accent-light); color: var(--accent); font-weight: 500; }
  .pf-opt-item.ph            { color: var(--text-placeholder); border-bottom: 1px solid var(--border);
                                margin-bottom: 2px; font-size: 13px; cursor: default; }
  .pf-opt-item.ph:hover      { background: transparent; }

  /* UPLOAD */
  .pf-upload {
    width: 100%;
    padding: 20px 16px;
    border: 1.5px dashed var(--border);
    border-radius: var(--radius-md);
    background: #FAFAF8;
    cursor: pointer;
    text-align: center;
    transition: border-color var(--ease), background var(--ease);
  }
  .pf-upload:hover      { border-color: var(--text-primary); background: #F5F5F2; }
  .pf-upload.drag       { border-color: var(--accent); background: var(--accent-light); }
  .pf-upload.err        { border-color: var(--border-error); }

  .pf-upload-icon {
    width: 34px; height: 34px;
    background: var(--border);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 9px;
    transition: background var(--ease);
  }
  .pf-upload:hover .pf-upload-icon { background: #DCDCD8; }
  .pf-upload-main { font-size: 13.5px; font-weight: 500; color: var(--text-primary); }
  .pf-upload-sub  { font-size: 12px; color: var(--text-placeholder); margin-top: 2px; }
  .pf-upload-file {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 9px; padding: 3px 9px;
    background: var(--accent-light); border-radius: 99px;
    font-size: 12px; font-weight: 500; color: var(--accent);
  }

  /* ERROR / BANNER */
  .pf-field-err {
    display: flex; align-items: center; gap: 5px;
    margin-top: 5px; font-size: 12px; color: var(--error);
  }
  .pf-banner {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px;
    background: var(--error-bg);
    border: 1px solid rgba(192,57,43,0.18);
    border-radius: var(--radius-md);
    font-size: 13.5px; color: var(--error);
    margin-bottom: 20px; line-height: 1.5;
  }
  .pf-banner svg { flex-shrink: 0; margin-top: 1px; }

  /* SUBMIT */
  .pf-submit-area { margin-top: 6px; }
  .pf-submit {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    width: 100%; height: 44px;
    background: var(--text-primary);
    color: #fff;
    border: none; border-radius: var(--radius-sm);
    font-family: var(--font); font-size: 14px; font-weight: 600;
    letter-spacing: -0.1px;
    cursor: pointer;
    transition: background var(--ease), transform 0.1s, box-shadow var(--ease);
  }
  .pf-submit:hover:not(:disabled) {
    background: #2A2A2A;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .pf-submit:active:not(:disabled) { transform: scale(0.994); }
  .pf-submit:disabled {
    background: #DCDCD8; color: var(--text-placeholder); cursor: not-allowed;
    box-shadow: none;
  }
  .pf-submit-arrow { transition: transform var(--ease); }
  .pf-submit:hover:not(:disabled) .pf-submit-arrow { transform: translateX(3px); }

  .pf-footnote {
    margin-top: 14px; text-align: center;
    font-size: 12px; color: var(--text-placeholder); line-height: 1.5;
  }
  .pf-footnote a { color: var(--text-secondary); text-decoration: underline; text-underline-offset: 2px; }

  /* CENTER PAGE (loading / error / success) */
  .pf-center {
    min-height: 100vh; display: flex;
    align-items: center; justify-content: center;
    background: var(--bg); padding: 20px;
  }
  .pf-info-card {
    max-width: 400px; width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 44px 32px;
    text-align: center;
    box-shadow: var(--shadow);
    animation: popIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .pf-icon-circle {
    width: 52px; height: 52px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 18px;
  }
  .pf-icon-circle.ok  { background: var(--success-bg); border: 1px solid rgba(39,174,96,0.22); color: var(--success); }
  .pf-icon-circle.bad { background: var(--error-bg);   border: 1px solid rgba(192,57,43,0.18); color: var(--error); }
  .pf-info-h { font-size: 19px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.3px; margin-bottom: 8px; }
  .pf-info-p { font-size: 14px; color: var(--text-secondary); line-height: 1.65; margin-bottom: 26px; }

  .pf-spinner {
    width: 30px; height: 30px;
    border: 2px solid var(--border);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
    margin: 0 auto 14px;
  }
  .pf-loading-txt { font-size: 13.5px; color: var(--text-secondary); text-align: center; }

  /* MOBILE */
  @media (max-width: 720px) {
    .pf-page   { padding: 0 0 60px; }
    .pf-layout { grid-template-columns: 1fr; gap: 0; padding-top: 0; }
    .pf-sidebar { position: static; padding: 28px 20px 0; }
    .pf-sidebar-title { font-size: 24px; }
    .pf-sidebar-meta, .pf-progress-track, .pf-progress-label { display: none; }
    .pf-card   { border-radius: 0; border-left: none; border-right: none; border-bottom: none; margin-top: 20px; }
    .pf-card-header, .pf-form-body { padding-left: 20px; padding-right: 20px; }
    .pf-row    { grid-template-columns: 1fr; }
    .pf-card-badge { display: none; }
  }
`;

/* ── Custom Select ── */
interface SelectProps {
  id: string; options: string[]; value: string; placeholder: string;
  hasError: boolean; onChange: (v: string) => void; onBlur: () => void;
}
const CustomSelect: React.FC<SelectProps> = ({ id, options, value, placeholder, hasError, onChange, onBlur }) => {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); onBlur(); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onBlur]);

  useEffect(() => {
    if (open && hi >= 0 && listRef.current) {
      const els = listRef.current.querySelectorAll('.pf-opt-item:not(.ph)');
      (els[hi] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
    }
  }, [hi, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && ['Enter',' ','ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); setHi(value ? options.indexOf(value) : 0); return; }
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(i+1, options.length-1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(i-1, 0)); }
      else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); onChange(options[hi]); setOpen(false); onBlur(); }
      else if (e.key === 'Escape') { setOpen(false); onBlur(); }
    }
  };

  return (
    <div ref={ref} className="pf-sel-wrap">
      <button type="button" id={id} role="combobox" aria-expanded={open}
        className={`pf-sel-btn${open?' open':''}${hasError?' err':''}`}
        onClick={() => { setOpen(o => !o); if (!open) setHi(value ? options.indexOf(value) : 0); }}
        onKeyDown={onKey}
      >
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          color: value ? 'var(--text-primary)' : 'var(--text-placeholder)' }}>
          {value || placeholder}
        </span>
        <span className={`pf-sel-icon${open?' open':''}`}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M3.5 5.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <ul ref={listRef} role="listbox" className="pf-dropdown">
          {!value && <li className="pf-opt-item ph">{placeholder}</li>}
          {options.map((opt, i) => (
            <li key={i} role="option"
              className={`pf-opt-item${opt===value?' sel':''}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); onBlur(); }}
            >
              <span>{opt}</span>
              {opt === value && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Main Component ── */
const PublicFormPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const shareToken = searchParams.get('share');

  // Build the query param for API calls — prefer share token over static token
  const authParam = shareToken ? `share=${shareToken}` : `token=${token}`;

  if (import.meta.env.DEV) {
    console.log('PublicFormPage — slug:', slug);
    console.log('PublicFormPage — shareToken:', shareToken, '| token:', token);
    console.log('PublicFormPage — API call will go to:', `${API_BASE_URL}/public/forms/${slug}?${authParam}`);
  }

  const [formData, setFormData] = useState<FormData | null>(null);
  const [vals, setVals] = useState<Record<string,any>>({});
  const [touched, setTouched] = useState<Record<string,boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [drag, setDrag] = useState<string|null>(null);
  const fileRefs = useRef<Record<string,HTMLInputElement|null>>({});

  useEffect(() => { load(); }, [slug, token, shareToken]);

  const load = async () => {
    if (!token && !shareToken) { setError('Access token is missing. Please use the link provided.'); setLoading(false); return; }
    try {
      const r = await axios.get(`${API_BASE_URL}/public/forms/${slug}?${authParam}`);
      setFormData(r.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load this form.');
    } finally { setLoading(false); }
  };

  const change = (key: string, val: any) => {
    setVals(p => ({ ...p, [key]: val }));
    setTouched(p => ({ ...p, [key]: true }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const fileChange = (key: string, f: File|null) => {
    setVals(p => ({ ...p, [key]: f }));
    setTouched(p => ({ ...p, [key]: true }));
  };

  const validate = () => {
    const e: Record<string,string> = {};
    formData?.fields.forEach(f => {
      if (f.is_required && !vals[f.field_key]) e[f.field_key] = `${f.label} is required`;
      if (f.field_type === 'email' && vals[f.field_key])
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals[f.field_key])) e[f.field_key] = 'Enter a valid email address';
      if (f.field_type === 'tel' && vals[f.field_key])
        if (vals[f.field_key].replace(/\D/g,'').length < 10) e[f.field_key] = 'Enter a valid phone number';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isValid = () => formData?.fields.every(f => !f.is_required || !!vals[f.field_key]) ?? false;

  const progress = (() => {
    if (!formData) return 0;
    const req = formData.fields.filter(f => f.is_required);
    if (!req.length) return 100;
    return Math.round(req.filter(f => !!vals[f.field_key]).length / req.length * 100);
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true); setError(null);
    try {
      const fd = new FormData();
      Object.keys(vals).forEach(k => {
        const v = vals[k];
        if (v instanceof File) fd.append(k, v);
        else if (v != null) fd.append(k, v.toString());
      });
      await axios.post(`${API_BASE_URL}/public/forms/${slug}/submit?${authParam}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess(true); setVals({}); setTouched({});
    } catch (e: any) {
      setError(e.response?.data?.message || 'Something went wrong. Please try again.');
    } finally { setSubmitting(false); }
  };

  /* ── Section mapping ── */
  const SECTION_MAP: Record<string,string> = {
    full_name:'Personal Information', email:'Personal Information',
    phone:'Personal Information', phone_number:'Personal Information',
    years_experience:'Professional Background', job_profile:'Professional Background',
    notice_period:'Professional Background', notice_period_days:'Professional Background',
    source:'Professional Background',
    current_ctc:'Compensation', expected_ctc:'Compensation',
  };

  /* ── Field renderer ── */
  const renderField = (field: FormField) => {
    const hasErr = !!errors[field.field_key];
    const hasOk  = touched[field.field_key] && !hasErr && !!vals[field.field_key];
    const cls = hasErr ? ' err' : hasOk ? ' ok' : '';
    const blurFn = () => setTouched(p => ({ ...p, [field.field_key]: true }));

    if (field.field_type === 'textarea') return (
      <textarea id={field.field_key} name={field.field_key}
        required={!!field.is_required} placeholder={field.placeholder || ''}
        className={`pf-input pf-textarea${cls}`}
        value={vals[field.field_key] || ''}
        onChange={e => change(field.field_key, e.target.value)} onBlur={blurFn} />
    );

    if (field.field_type === 'select') return (
      <CustomSelect id={field.field_key} options={field.options||[]}
        value={vals[field.field_key]||''} placeholder={`Select ${field.label}`}
        hasError={hasErr} onChange={v => change(field.field_key, v)} onBlur={blurFn} />
    );

    if (field.field_type === 'file') {
      const isDrag = drag === field.field_key;
      const file = vals[field.field_key] as File|undefined;
      return (
        <div className={`pf-upload${isDrag?' drag':''}${hasErr?' err':''}`}
          onClick={() => fileRefs.current[field.field_key]?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(field.field_key); }}
          onDragLeave={() => setDrag(null)}
          onDrop={e => { e.preventDefault(); setDrag(null); const f=e.dataTransfer.files[0]; if(f) fileChange(field.field_key,f); }}>
          <input ref={el => { fileRefs.current[field.field_key]=el; }} type="file"
            id={field.field_key} accept=".pdf,.doc,.docx" style={{display:'none'}}
            onChange={e => fileChange(field.field_key, e.target.files?.[0]||null)} />
          <div className="pf-upload-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="pf-upload-main">Click to upload or drag &amp; drop</p>
          <p className="pf-upload-sub">PDF, DOC or DOCX — max 10 MB</p>
          {file && <span className="pf-upload-file">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {file.name}
          </span>}
        </div>
      );
    }

    return (
      <input id={field.field_key} name={field.field_key} type={field.field_type}
        required={!!field.is_required} placeholder={field.placeholder||''}
        className={`pf-input${cls}`}
        value={vals[field.field_key]||''}
        onChange={e => change(field.field_key, e.target.value)} onBlur={blurFn} />
    );
  };

  /* ── Render all fields with sections ── */
  const renderFields = () => {
    if (!formData) return null;
    let lastSec = '';

    // Detect paired compensation fields for 2-col layout
    const fields = formData.fields;
    const rendered: React.ReactNode[] = [];
    let i = 0;

    while (i < fields.length) {
      const field = fields[i];
      const sec = SECTION_MAP[field.field_key] || '';
      const showSec = sec && sec !== lastSec;
      if (showSec) lastSec = sec;

      // Pair current_ctc + expected_ctc side by side
      const next = fields[i+1];
      const isPaired =
        field.field_key === 'current_ctc' && next?.field_key === 'expected_ctc';

      if (showSec) {
        rendered.push(
          <div key={`sec-${sec}`} className="pf-section">
            <span className="pf-section-pill">{sec}</span>
            <div className="pf-section-line" />
          </div>
        );
      }

      if (isPaired) {
        rendered.push(
          <div key="ctc-row" className="pf-row">
            {[field, next].map(f => (
              <div key={f.id} className="pf-field">
                <label htmlFor={f.field_key} className="pf-label">
                  {f.label}
                  {f.is_required ? <span className="pf-req">*</span> : <span className="pf-opt">Optional</span>}
                </label>
                {renderField(f)}
                {errors[f.field_key] && (
                  <p className="pf-field-err">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5.5" stroke="currentColor"/>
                      <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {errors[f.field_key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
        i += 2;
      } else {
        rendered.push(
          <div key={field.id} className="pf-field">
            <label htmlFor={field.field_key} className="pf-label">
              {field.label}
              {field.is_required ? <span className="pf-req">*</span> : <span className="pf-opt">Optional</span>}
            </label>
            {renderField(field)}
            {errors[field.field_key] && (
              <p className="pf-field-err">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor"/>
                  <path d="M6 3.5v3M6 8v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {errors[field.field_key]}
              </p>
            )}
          </div>
        );
        i += 1;
      }
    }
    return rendered;
  };

  /* ── States ── */
  if (loading) return (
    <>
      <style>{globalStyles}</style>
      <div className="pf-center">
        <div><div className="pf-spinner" /><p className="pf-loading-txt">Loading your application form…</p></div>
      </div>
    </>
  );

  if (error && !formData) return (
    <>
      <style>{globalStyles}</style>
      <div className="pf-center">
        <div className="pf-info-card">
          <div className="pf-icon-circle bad">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M12 7v5M12 15.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="pf-info-h">Unable to Load Form</h2>
          <p className="pf-info-p">{error}</p>
        </div>
      </div>
    </>
  );

  if (success) return (
    <>
      <style>{globalStyles}</style>
      <div className="pf-center">
        <div className="pf-info-card">
          <div className="pf-icon-circle ok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="pf-info-h">Application Submitted</h2>
          <p className="pf-info-p">
            Thank you for your interest. We've received your application and our team will review it shortly.
          </p>
          <button className="pf-submit" onClick={() => { setSuccess(false); setVals({}); setTouched({}); }}
            style={{ width: 'auto', padding: '0 22px', margin: '0 auto' }}>
            Submit Another
          </button>
        </div>
      </div>
    </>
  );

  /* ── Main form ── */
  return (
    <>
      <style>{globalStyles}</style>
      <div className="pf-page">
        <div className="pf-layout">

          {/* Sidebar */}
          <aside className="pf-sidebar">
            <div className="pf-sidebar-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="1.5" fill="white"/>
                <rect x="13" y="3" width="8" height="8" rx="1.5" fill="white" opacity="0.55"/>
                <rect x="3" y="13" width="8" height="8" rx="1.5" fill="white" opacity="0.55"/>
                <rect x="13" y="13" width="8" height="8" rx="1.5" fill="white" opacity="0.25"/>
              </svg>
            </div>
            <p className="pf-sidebar-eyebrow">Open Position</p>
            <h1 className="pf-sidebar-title">
              {formData?.form.job_title
                ? <>Apply for <em>{formData.form.job_title}</em></>
                : formData?.form.name}
            </h1>
            {formData?.form.description && (
              <p className="pf-sidebar-desc">{formData.form.description}</p>
            )}
            <div className="pf-sidebar-meta">
              <div className="pf-meta-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Takes about 5 minutes
              </div>
              <div className="pf-meta-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Your data is kept confidential
              </div>
              <div className="pf-meta-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Fields marked * are required
              </div>
            </div>
            <div className="pf-progress-label">
              <span>Progress</span>
              <span className="pf-progress-pct"
                style={{ color: progress === 100 ? 'var(--success)' : 'var(--text-secondary)' }}>
                {progress}%
              </span>
            </div>
            <div className="pf-progress-track">
              <div className="pf-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </aside>

          {/* Card */}
          <div className="pf-card">
            <div className="pf-card-header">
              <div className="pf-card-header-left">
                <p className="pf-card-eyebrow">Candidate Application</p>
                <h2 className="pf-card-title">{formData?.form.name}</h2>
              </div>
              {formData?.form.job_title && (
                <span className="pf-card-badge">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <circle cx="5" cy="5" r="5"/>
                  </svg>
                  {formData.form.job_title}
                </span>
              )}
            </div>

            <div className="pf-form-body">
              <form onSubmit={submit} noValidate>
                {error && (
                  <div className="pf-banner">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <circle cx="7.5" cy="7.5" r="7" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M7.5 4v4M7.5 10v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}

                {renderFields()}

                <div className="pf-submit-area">
                  <button type="submit" disabled={submitting || !isValid()} className="pf-submit">
                    {submitting ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                          style={{ animation: 'spin 0.65s linear infinite' }}>
                          <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8"/>
                          <path d="M6.5 1a5.5 5.5 0 015.5 5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                        Submitting…
                      </>
                    ) : (
                      <>
                        Submit Application
                        <svg className="pf-submit-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 6.5h9M8 3.5L11 6.5 8 9.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                <p className="pf-footnote">
                  By submitting, you agree to our{' '}
                  <a href="#">Privacy Policy</a> and <a href="#">Terms of Service</a>.
                </p>
              </form>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default PublicFormPage;