/**
 * AttachmentsSection — Section 5 of the left panel (lazy-loaded)
 *
 * Modern attachment cards with:
 *   - File type icon
 *   - Filename, size, uploader, date
 *   - Preview (opens DocViewer), Download, Delete
 *   - Drag-and-drop upload area
 *   - Multiple file upload support
 *
 * All operations use existing plannerService attachment methods.
 * DocViewer is the existing custom viewer already in the codebase.
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import {
  Upload,
  Download,
  Trash2,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  UploadCloud,
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

interface AttachmentsSectionProps {
  taskId: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType, className = 'w-5 h-5' }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType === 'text/csv')
    return <FileSpreadsheet className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return <FileArchive className={className} />;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return <File className={className} />;
  if (mimeType.startsWith('text/') || mimeType.includes('word'))
    return <FileText className={className} />;
  return <File className={className} />;
}

function fileIconColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'text-violet-500 bg-violet-50 dark:bg-violet-900/20';
  if (mimeType === 'application/pdf') return 'text-red-500 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType === 'text/csv')
    return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
  if (mimeType.includes('zip')) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
  return 'text-gray-500 bg-gray-100 dark:bg-neutral-700';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function AttachmentsSection({ taskId }: AttachmentsSectionProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewing, setViewing] = useState<ViewerAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await plannerService.getAttachments(taskId);
      setAttachments(data ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // ── Upload handlers ─────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        await plannerService.uploadAttachment(taskId, file);
        await fetchAttachments();
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Upload failed';
        alert(msg);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [taskId, fetchAttachments]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => uploadFile(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => uploadFile(f));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ── Delete / Download / View ────────────────────────────────────────────

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`Delete "${att.original_filename}"?`)) return;
    await plannerService.deleteAttachment(att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const handleDownload = (att: Attachment) => {
    const a = document.createElement('a');
    a.href = plannerService.downloadAttachment(att.id);
    a.download = att.original_filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const canDelete = (att: Attachment) =>
    user?.role === 'Admin' || att.uploaded_by === user?.id;

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-neutral-800 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* DocViewer overlay */}
      {viewing && (
        <DocViewer
          attachment={viewing}
          fetchFile={plannerService.fetchAttachment}
          downloadUrl={plannerService.downloadAttachment(viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}

      <div className="space-y-3">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 ${
            isDragOver
              ? 'border-red-400 bg-red-50 dark:bg-red-900/10 dark:border-red-500'
              : 'border-gray-200 dark:border-neutral-700 hover:border-red-300 dark:hover:border-red-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50'
          } ${uploading ? 'opacity-60 pointer-events-none' : ''}`}
          role="button"
          aria-label="Upload files"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInput}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.zip,.ppt,.pptx"
          />
          {uploading ? (
            <span className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UploadCloud
              className={`w-6 h-6 ${
                isDragOver
                  ? 'text-red-500'
                  : 'text-gray-300 dark:text-neutral-600'
              }`}
            />
          )}
          <p className="text-sm text-gray-500 dark:text-neutral-400 text-center">
            {uploading ? 'Uploading…' : (
              <>
                <span className="font-medium text-red-600 dark:text-red-400">Click to upload</span>
                {' '}or drag & drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">
            PDF, DOC, XLS, PNG, JPG, ZIP, PPT · Max 10 MB
          </p>
        </div>

        {/* Attachment list */}
        {attachments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500 text-center py-2">
            No attachments yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-gray-200 dark:hover:border-neutral-600 group transition-all duration-150"
              >
                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${fileIconColor(att.mime_type)}`}
                >
                  <FileTypeIcon mimeType={att.mime_type} className="w-4 h-4" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setViewing(att as ViewerAttachment)}
                    className="block text-left text-sm font-medium text-gray-700 dark:text-neutral-200 truncate hover:text-red-600 dark:hover:text-red-400 transition-colors w-full"
                    title={att.original_filename}
                  >
                    {att.original_filename}
                  </button>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">
                    {formatBytes(att.file_size)} · {att.uploader_name} ·{' '}
                    {new Date(att.uploaded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                  <button
                    onClick={() => setViewing(att as ViewerAttachment)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors duration-100"
                    aria-label="Preview"
                    title="Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDownload(att)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-100"
                    aria-label="Download"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {canDelete(att) && (
                    <button
                      onClick={() => handleDelete(att)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-100"
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
});
