import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../services/api';
import { AlertTriangle, Check, Archive } from 'lucide-react';

interface DuplicateRow {
  id: number;
  match_type: string;
  confidence_score: number;
  candidate_name: string;
  email: string;
  matched_name: string;
  matched_email: string;
  matched_stage: string;
  application_ref: string;
  version: number;
  created_at: string;
}

const ApplicationDuplicatesPanel: React.FC = () => {
  const [rows, setRows] = useState<DuplicateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/candidate-applications/duplicates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.data.data?.duplicates || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: number, action: 'intentional' | 'archive') => {
    const token = localStorage.getItem('token');
    const path =
      action === 'intentional'
        ? `${API_BASE_URL}/candidate-applications/duplicates/${id}/intentional`
        : `${API_BASE_URL}/candidate-applications/duplicates/${id}/archive`;
    const method = action === 'intentional' ? 'patch' : 'post';
    await axios[method](path, null, { headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Loading duplicate applications…
      </div>
    );
  }

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-700" />
        <h3 className="font-semibold text-amber-900">Application duplicates ({rows.length})</h3>
      </div>
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm border border-amber-100"
          >
            <span>
              <strong>{row.candidate_name}</strong> ↔ {row.matched_name} ·{' '}
              <span className="text-gray-500">{row.match_type}</span>
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                title="Mark intentional"
                className="p-1.5 rounded hover:bg-amber-100 text-amber-800"
                onClick={() => resolve(row.id, 'intentional')}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Archive"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                onClick={() => resolve(row.id, 'archive')}
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ApplicationDuplicatesPanel;
