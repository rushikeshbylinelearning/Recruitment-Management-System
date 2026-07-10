import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Download, Trash2, Eye,
  File, FileText, Image as ImageIcon, FileSpreadsheet, FileArchive,
} from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import { useAuth } from '../../../../contexts/AuthContext';
import DocViewer, { type ViewerAttachment } from '../../viewer/DocViewer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: number;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploader_name: string;
  uploaded_at: string;
}

interface FilesTabProps {
  taskId: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = className ?? 'w-4 h-4';
  if (mimeType.startsWith('image/')) return <ImageIcon className={cls} />;
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/'))
    return <FileText className={cls} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType === 'text/csv')
    return <FileSpreadsheet className={cls} />;
  if (mimeType.includes('zip')) return <FileArchive className={cls} />;
  return <File className={cls} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilesTab({ taskId }: FilesTabProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<ViewerAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await plannerService.getAttachments(taskId);
      setAttachments(data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await plannerService.uploadAttachment(taskId, file);
      await fetchAttachments();
    } catch (err: unknown) {
      alert(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Upload failed'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    await plannerService.deleteAttachment(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDownload = (id: number, filename: string) => {
    const a = document.createElement('a');
    a.href = plannerService.downloadAttachment(id);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleView = (att: Attachment) => {
    // Cast to ViewerAttachment — same shape, just type-checked by DocViewer
    setViewingAttachment(att as ViewerAttachment);
  };

  const canDelete = (att: Attachment) =>
    user?.role === 'Admin' || att.uploaded_by === user?.id;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 animate-pulse space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-neutral-700 rounded" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* ── Custom Document Viewer ─────────────────────────────────────────── */}
      {viewingAttachment && (
        <DocViewer
          attachment={viewingAttachment}
          fetchFile={plannerService.fetchAttachment}
          downloadUrl={plannerService.downloadAttachment(viewingAttachment.id)}
          onClose={() => setViewingAttachment(null)}
        />
      )}

      <div className="p-4 space-y-3 overflow-y-auto">
        {/* ── Upload button ─────────────────────────────────────────────── */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.zip,.ppt,.pptx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-neutral-600 text-sm text-gray-500 dark:text-neutral-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
            PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG, ZIP, PPT · Max 10 MB
          </p>
        </div>

        {/* ── Attachment list ───────────────────────────────────────────── */}
        {attachments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No files attached yet.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 group"
              >
                {/* Icon */}
                <FileIcon
                  mimeType={att.mime_type}
                  className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0"
                />

                {/* File info — clicking name opens viewer */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleView(att)}
                    className="block w-full text-left text-sm font-medium text-gray-700 dark:text-neutral-200 truncate hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150"
                    title={`Preview ${att.original_filename}`}
                  >
                    {att.original_filename}
                  </button>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">
                    {formatBytes(att.file_size)} · {att.uploader_name} ·{' '}
                    {new Date(att.uploaded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Preview */}
                  <button
                    onClick={() => handleView(att)}
                    className="p-1 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
                    aria-label={`Preview ${att.original_filename}`}
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Download */}
                  <button
                    onClick={() => handleDownload(att.id, att.original_filename)}
                    className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
                    aria-label="Download"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  {canDelete(att) && (
                    <button
                      onClick={() => handleDelete(att.id, att.original_filename)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors duration-150"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
