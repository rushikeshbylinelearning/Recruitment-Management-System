import React, { useState, useEffect } from 'react';
import {
  X, Send, Trash2, FileText, Clock, CheckCircle, XCircle,
  AlertCircle, Upload, Paperclip, User, Briefcase, Calendar,
  UserCheck, RefreshCw, File, FileImage, FileVideo,
} from 'lucide-react';
import { assignmentsAPI, Assignment, API_BASE_URL } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AssignmentDetailsModalProps {
  assignment: Assignment;
  onClose: () => void;
  onUpdate: () => void;
}

// ── Auth-aware inline renderer ────────────────────────────────────────────────
function InlineFileRenderer({
  url, mimeType, name,
}: { url: string; mimeType: string; name: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let obj: string | null = null;
    setLoading(true); setError(null); setBlobUrl(null);
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async r => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.blob();
      })
      .then(blob => {
        const b = blob.type && blob.type !== 'application/octet-stream'
          ? blob : new Blob([blob], { type: mimeType });
        obj = URL.createObjectURL(b);
        setBlobUrl(obj);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    return () => { if (obj) URL.revokeObjectURL(obj); };
  }, [url, mimeType]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-gray-400">
      <RefreshCw size={26} className="animate-spin text-indigo-400" />
      <p className="text-sm text-gray-400">Loading preview…</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3">
      <File size={40} className="text-gray-200" />
      <p className="text-sm font-medium text-gray-500">Preview unavailable</p>
      <p className="text-xs text-gray-400 max-w-xs text-center">{error}</p>
    </div>
  );

  const mime = mimeType.toLowerCase();
  if (mime.includes('pdf'))
    return <iframe src={blobUrl!} className="w-full h-full border-0" title={name} />;
  if (mime.startsWith('image/'))
    return (
      <div className="flex items-center justify-center w-full h-full p-6 bg-[#f8f8f8]">
        <img src={blobUrl!} alt={name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
      </div>
    );
  if (mime.startsWith('video/'))
    return (
      <div className="flex items-center justify-center w-full h-full p-6 bg-black">
        <video src={blobUrl!} controls className="max-w-full max-h-full rounded-lg" />
      </div>
    );
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-3">
      <File size={48} className="text-gray-200" />
      <p className="text-sm font-medium text-gray-500">{name}</p>
      <p className="text-xs text-gray-400">No preview available for this file type</p>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
const AssignmentDetailsModal: React.FC<AssignmentDetailsModalProps> = ({
  assignment: initialAssignment, onClose, onUpdate,
}) => {
  const { hasPermission } = useAuth();
  const [assignment, setAssignment] = useState<Assignment>(initialAssignment);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [newStatus, setNewStatus] = useState(initialAssignment.status);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const canEdit = hasPermission('assignments', 'edit');
  const canDelete = hasPermission('assignments', 'delete');

  useEffect(() => {
    (async () => {
      setFetching(true);
      try {
        const res = await assignmentsAPI.getAssignment(initialAssignment.id);
        if (res.success && res.data) { setAssignment(res.data); setNewStatus(res.data.status); }
      } catch { /* silent */ } finally { setFetching(false); }
    })();
  }, [initialAssignment.id]);

  const statusConfig: Record<string, { pill: string; dot: string }> = {
    Draft:         { pill: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-400' },
    Assigned:      { pill: 'bg-blue-50 text-blue-600 border-blue-200',        dot: 'bg-blue-500' },
    'In Progress': { pill: 'bg-amber-50 text-amber-600 border-amber-200',     dot: 'bg-amber-500' },
    Submitted:     { pill: 'bg-violet-50 text-violet-600 border-violet-200',  dot: 'bg-violet-500' },
    Approved:      { pill: 'bg-emerald-50 text-emerald-600 border-emerald-200',dot: 'bg-emerald-500' },
    Rejected:      { pill: 'bg-red-50 text-red-500 border-red-200',           dot: 'bg-red-500' },
    Cancelled:     { pill: 'bg-gray-100 text-gray-400 border-gray-200',       dot: 'bg-gray-400' },
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const fmtDT = (d: string) => new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtSize = (b: number) => { if (!b) return '0 B'; const k = 1024, s = ['B','KB','MB','GB'], i = Math.floor(Math.log(b)/Math.log(k)); return `${parseFloat((b/Math.pow(k,i)).toFixed(1))} ${s[i]}`; };

  const fileIcon = (mime: string, sz = 13) => {
    if (mime?.includes('pdf'))   return <FileText size={sz} className="text-rose-400" />;
    if (mime?.includes('word') || mime?.includes('docx')) return <FileText size={sz} className="text-blue-400" />;
    if (mime?.includes('image')) return <FileImage size={sz} className="text-emerald-400" />;
    if (mime?.includes('video')) return <FileVideo size={sz} className="text-purple-400" />;
    return <File size={sz} className="text-gray-400" />;
  };

  const handleSend = async () => {
    setLoading(true); setError(null);
    try { const r = await assignmentsAPI.sendAssignment(assignment.id); if (r.success) { onUpdate(); onClose(); } else setError(r.message || 'Failed to send'); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleStatusUpdate = async () => {
    setLoading(true); setError(null);
    try {
      const r = await assignmentsAPI.updateStatus(assignment.id, newStatus);
      if (r.success) {
        onUpdate(); setShowStatusUpdate(false);
        const fresh = await assignmentsAPI.getAssignment(assignment.id);
        if (fresh.success && fresh.data) setAssignment(fresh.data);
      } else setError(r.message || 'Failed to update');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return;
    setLoading(true); setError(null);
    try { const r = await assignmentsAPI.deleteAssignment(assignment.id); if (r.success) { onUpdate(); onClose(); } else setError(r.message || 'Failed to delete'); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const handleRemoveFile = async (fileId: number) => {
    if (!window.confirm('Remove this attachment?')) return;
    setLoading(true); setError(null);
    try {
      const r = await assignmentsAPI.removeFile(assignment.id, fileId);
      if (r.success) {
        onUpdate();
        const remaining = assignment.attachments?.filter(f => f.id !== fileId) ?? [];
        setAssignment(prev => ({ ...prev, attachments: remaining }));
        if (activeFileIndex >= remaining.length) setActiveFileIndex(Math.max(0, remaining.length - 1));
      } else setError(r.message || 'Failed to remove');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  const sc = statusConfig[assignment.status] ?? statusConfig['Draft'];
  const attachments = assignment.attachments ?? [];
  const activeFile = attachments[activeFileIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: '1100px', height: '88vh' }}
      >

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileText size={17} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight truncate">{assignment.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                  {assignment.status}
                </span>
                {assignment.due_date && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Calendar size={10} /> Due {fmt(assignment.due_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-4">
            {assignment.status === 'Draft' && canEdit && (
              <button onClick={handleSend} disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">
                <Send size={12} /> Send
              </button>
            )}
            {canEdit && (
              <button onClick={() => setShowStatusUpdate(true)} title="Update status"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                <RefreshCw size={14} />
              </button>
            )}
            {assignment.status === 'Draft' && canDelete && (
              <button onClick={handleDelete} disabled={loading} title="Delete"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 shrink-0">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {/* ── BODY ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── LEFT SIDEBAR (25%) — secondary info ── */}
          <div className="w-[260px] shrink-0 border-r border-gray-100 overflow-y-auto py-5 px-5 flex flex-col gap-5">

            {/* Meta info */}
            <div className="space-y-3.5">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Info</p>

              {assignment.candidate_name && (
                <div className="flex items-start gap-2.5">
                  <User size={13} className="text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none mb-0.5">Candidate</p>
                    <p className="text-xs font-semibold text-gray-700">{assignment.candidate_name}</p>
                    {assignment.candidate_email && <p className="text-[10px] text-gray-400 mt-0.5">{assignment.candidate_email}</p>}
                  </div>
                </div>
              )}

              {assignment.job_title && (
                <div className="flex items-start gap-2.5">
                  <Briefcase size={13} className="text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none mb-0.5">Job</p>
                    <p className="text-xs font-semibold text-gray-700">{assignment.job_title}</p>
                  </div>
                </div>
              )}

              {assignment.assigned_by_name && (
                <div className="flex items-start gap-2.5">
                  <UserCheck size={13} className="text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none mb-0.5">Assigned By</p>
                    <p className="text-xs font-semibold text-gray-700">{assignment.assigned_by_name}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <Clock size={13} className="text-gray-300 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div>
                    <p className="text-[10px] text-gray-400 leading-none mb-0.5">Created</p>
                    <p className="text-[11px] text-gray-600">{fmtDT(assignment.created_at)}</p>
                  </div>
                  {assignment.updated_at !== assignment.created_at && (
                    <div>
                      <p className="text-[10px] text-gray-400 leading-none mb-0.5">Updated</p>
                      <p className="text-[11px] text-gray-600">{fmtDT(assignment.updated_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">Description</p>
              {assignment.description_html ? (
                <div
                  className="text-[12px] text-gray-500 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: assignment.description_html }}
                />
              ) : (
                <p className="text-xs text-gray-400 italic">No description provided.</p>
              )}
            </div>

            {/* Communications */}
            {assignment.communications && assignment.communications.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">History</p>
                <div className="space-y-2">
                  {assignment.communications.map(comm => (
                    <div key={comm.id} className="px-3 py-2 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-gray-600">{comm.type}</span>
                        <span className="text-[10px] text-gray-400">{fmtDT(comm.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{comm.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL (75%) — VIEWER IS PRIMARY ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#fafafa]">

            {/* File tabs bar */}
            <div className="px-5 pt-4 pb-3 bg-white border-b border-gray-100 shrink-0">
              {fetching ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <RefreshCw size={12} className="animate-spin" /> Loading…
                </div>
              ) : attachments.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Paperclip size={12} className="text-gray-300" /> No attachments
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {attachments.map((file, idx) => (
                    <button
                      key={file.id}
                      onClick={() => setActiveFileIndex(idx)}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 ${
                        idx === activeFileIndex
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <span className={idx === activeFileIndex ? 'opacity-75' : 'opacity-60'}>
                        {fileIcon(file.mime_type, 12)}
                      </span>
                      <span className="max-w-[160px] truncate">{file.original_name}</span>
                      {idx === activeFileIndex && (
                        <span className="text-indigo-200 text-[10px] ml-0.5">{fmtSize(file.file_size)}</span>
                      )}
                    </button>
                  ))}

                  {/* Remove button for active file */}
                  {activeFile && canEdit && (
                    <button
                      onClick={() => handleRemoveFile(activeFile.id)}
                      title="Remove file"
                      className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── VIEWER — dominant element ── */}
            <div className="flex-1 overflow-hidden min-h-0 p-4">
              {fetching ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                  <RefreshCw size={24} className="animate-spin text-indigo-300" />
                  <p className="text-sm">Loading attachments…</p>
                </div>
              ) : attachments.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200">
                  <Paperclip size={36} className="text-gray-200" />
                  <p className="text-sm text-gray-400">No attachments uploaded</p>
                </div>
              ) : activeFile ? (
                <div className="w-full h-full rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <InlineFileRenderer
                    url={`${API_BASE_URL}/files/view/${activeFile.filename}`}
                    mimeType={activeFile.mime_type}
                    name={activeFile.original_name}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATUS UPDATE SUB-MODAL ── */}
      {showStatusUpdate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Update Status</h3>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest">New Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {['Draft','Assigned','In Progress','Submitted','Approved','Rejected','Cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowStatusUpdate(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleStatusUpdate} disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentDetailsModal;
