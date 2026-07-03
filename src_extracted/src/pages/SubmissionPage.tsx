import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = ['video/mp4', 'image/png', 'image/jpeg', 'application/pdf'];
const ACCEPTED_EXTENSIONS = '.mp4,.png,.jpeg,.jpg,.pdf';
const ACCEPTED_LABEL = '.mp4, .png, .jpeg, .pdf';

interface AssignmentMeta {
  assignmentTitle: string;
  candidateName: string;
  deadline: string;
}

interface SelectedFile {
  file: File;
  id: string;
  error?: string;
}

type PageState = 'loading' | 'error_403' | 'error_410' | 'form' | 'success';

const SubmissionPage: React.FC = () => {
  const { candidateId, token } = useParams<{ candidateId: string; token: string }>();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [meta, setMeta] = useState<AssignmentMeta | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    validateToken();
  }, [candidateId, token]);

  const validateToken = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/public/submit-assignment/${candidateId}/${token}`
      );
      setMeta({
        assignmentTitle: res.data?.data?.assignmentTitle || res.data?.data?.assignment_title || 'Assignment Submission',
        candidateName: res.data?.data?.candidateName || res.data?.data?.candidate_name || '',
        deadline: res.data?.data?.deadline || '',
      });
      setPageState('form');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 410) {
        setPageState('error_410');
      } else {
        setPageState('error_403');
      }
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}" is not an accepted file type. Accepted: ${ACCEPTED_LABEL}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit (${(file.size / 1024 / 1024).toFixed(1)}MB).`;
    }
    return null;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    let firstError: string | null = null;
    const valid: SelectedFile[] = [];

    for (const file of files) {
      const err = validateFile(file);
      if (err) {
        if (!firstError) firstError = err;
      } else {
        valid.push({ file, id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}` });
      }
    }

    // Preserve previously selected files; append valid new ones
    setSelectedFiles(prev => [...prev, ...valid]);
    setFileError(firstError);
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input so same file can be re-added after removal
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(sf => formData.append('files', sf.file));
      if (notes.trim()) formData.append('notes', notes.trim());

      await axios.post(
        `${API_BASE_URL}/public/submit-assignment/${candidateId}/${token}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setPageState('success');
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || 'Submission failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDeadline = (iso: string) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Verifying your link…</p>
        </div>
      </div>
    );
  }

  // ── 403 Error ────────────────────────────────────────────────────────────
  if (pageState === 'error_403') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500">Invalid or unauthorized access.</p>
        </div>
      </div>
    );
  }

  // ── 410 Error ────────────────────────────────────────────────────────────
  if (pageState === 'error_410') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-sm text-gray-500">Link expired. Contact HR.</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Submission Received</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Your assignment has been submitted successfully. The hiring team will review it and get back to you.
          </p>
        </div>
      </div>
    );
  }

  // ── Upload Form ──────────────────────────────────────────────────────────
  const canSubmit = selectedFiles.length > 0 && !submitting;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-8 py-6">
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              {meta?.assignmentTitle || 'Assignment Submission'}
            </h1>
            {meta?.candidateName && (
              <p className="mt-1 text-sm text-gray-500">Hi {meta.candidateName},</p>
            )}
            {meta?.deadline && (
              <p className="mt-2 text-xs text-gray-400">
                Deadline: <span className="font-medium text-gray-600">{formatDeadline(meta.deadline)}</span>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
            {/* Drop zone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Files <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-indigo-400 bg-indigo-50'
                    : fileError
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-500">
                  Drag &amp; drop files here, or <span className="text-indigo-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Accepted: {ACCEPTED_LABEL} · Max {MAX_FILE_SIZE_MB}MB per file
                </p>
              </div>

              {/* File error */}
              {fileError && (
                <p className="mt-2 text-xs text-red-600">{fileError}</p>
              )}

              {/* Selected files list */}
              {selectedFiles.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {selectedFiles.map(sf => (
                    <li
                      key={sf.id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-sm text-gray-700 truncate">{sf.file.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {(sf.file.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(sf.id)}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label={`Remove ${sf.file.name}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Any context or comments for the hiring team…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full h-11 rounded-lg text-sm font-semibold transition-colors ${
                canSubmit
                  ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.99]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? 'Submitting…' : 'Submit Assignment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmissionPage;
