import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Download, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
  FileText, Film, Image, File, Maximize2, Minimize2, Loader2
} from 'lucide-react';

export interface ViewerFile {
  name: string;       // original filename for display
  url: string;        // full URL to the file
  mimeType?: string;  // optional — inferred from name if omitted
}

interface FileViewerProps {
  files: ViewerFile[];
  initialIndex?: number;
  onClose: () => void;
}

// ── Auth-aware blob URL hook ──────────────────────────────────────────────────
// Fetches a URL with the auth token and returns a local blob URL for rendering.
// Falls back to the original URL if no token is present (public files).
function useAuthBlobUrl(url: string, mimeType: string): { blobUrl: string | null; loading: boolean; error: string | null } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Failed to load file (${res.status})${text ? ': ' + text.slice(0, 120) : ''}`);
        }
        return res.blob();
      })
      .then((blob) => {
        // Use the provided mimeType if the blob type is generic
        const finalBlob = blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mimeType });
        objectUrl = URL.createObjectURL(finalBlob);
        setBlobUrl(objectUrl);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, mimeType]);

  return { blobUrl, loading, error };
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm">Loading file…</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
      <div className="text-center">
        <File size={48} className="text-red-300 mx-auto mb-3" />
        <p className="text-sm text-red-600 font-medium">Failed to load file</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">{message}</p>
      </div>
    </div>
  );
}

// ── MIME / extension helpers ──────────────────────────────────────────────────

function getMime(file: ViewerFile): string {
  if (file.mimeType) return file.mimeType.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    mp4: 'video/mp4', mov: 'video/mp4', webm: 'video/webm',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

type FileKind = 'image' | 'video' | 'pdf' | 'office' | 'text' | 'unknown';

function getKind(mime: string): FileKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'text';
  if (
    mime.includes('word') || mime.includes('excel') ||
    mime.includes('spreadsheet') || mime.includes('presentation') ||
    mime.includes('powerpoint') || mime.includes('msword') ||
    mime.includes('ms-excel')
  ) return 'office';
  return 'unknown';
}

function FileIcon({ mime }: { mime: string }) {
  const kind = getKind(mime);
  const cls = 'w-5 h-5 flex-shrink-0';
  if (kind === 'image') return <Image className={cls} />;
  if (kind === 'video') return <Film className={cls} />;
  if (kind === 'pdf') return <FileText className={cls} />;
  if (kind === 'office') return <FileText className={cls} />;
  return <File className={cls} />;
}

// ── Individual renderers ──────────────────────────────────────────────────────

function ImageRenderer({ url, name, mime }: { url: string; name: string; mime: string }) {
  const { blobUrl, loading, error } = useAuthBlobUrl(url, mime);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  if (loading) return <LoadingState />;
  if (error || !blobUrl) return <ErrorState message={error ?? 'Unknown error'} />;

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Zoom out"><ZoomOut size={16} /></button>
        <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Zoom in"><ZoomIn size={16} /></button>
        <button onClick={() => setZoom(1)} className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors">Reset</button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button onClick={() => setRotate(r => (r + 90) % 360)} className="p-1.5 rounded hover:bg-gray-200 transition-colors" title="Rotate"><RotateCw size={16} /></button>
      </div>
      {/* image */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 p-4">
        <img
          src={blobUrl}
          alt={name}
          style={{ transform: `scale(${zoom}) rotate(${rotate}deg)`, transformOrigin: 'center', transition: 'transform 0.2s' }}
          className="max-w-none shadow-lg rounded"
          draggable={false}
        />
      </div>
    </div>
  );
}

function VideoRenderer({ url, name, mime }: { url: string; name: string; mime: string }) {
  const { blobUrl, loading, error } = useAuthBlobUrl(url, mime);

  if (loading) return <LoadingState />;
  if (error || !blobUrl) return <ErrorState message={error ?? 'Unknown error'} />;

  return (
    <div className="flex-1 flex items-center justify-center bg-black p-4">
      <video
        src={blobUrl}
        controls
        className="max-h-full max-w-full rounded shadow-lg"
        style={{ maxHeight: 'calc(100vh - 160px)' }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

function PdfRenderer({ url }: { url: string }) {
  const { blobUrl, loading, error } = useAuthBlobUrl(url, 'application/pdf');

  if (loading) return <LoadingState />;
  if (error || !blobUrl) return <ErrorState message={error ?? 'Unknown error'} />;

  return (
    <iframe
      src={`${blobUrl}#toolbar=1&navpanes=1&scrollbar=1`}
      className="flex-1 w-full border-0"
      title="PDF Viewer"
      style={{ minHeight: 0 }}
    />
  );
}

function OfficeRenderer({ url, name }: { url: string; name: string }) {
  // Use Microsoft Office Online viewer for DOCX/XLSX/PPTX
  // Works for publicly accessible URLs; for localhost we show a download prompt
  const isLocalhost = url.startsWith('http://localhost') || url.startsWith('/');
  const absoluteUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;

  if (isLocalhost) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <FileText size={56} className="text-blue-400" />
        <div>
          <p className="text-gray-700 font-medium text-lg mb-1">{name}</p>
          <p className="text-gray-500 text-sm mb-4">
            Office documents can't be previewed on localhost.<br />
            Download the file to open it in Microsoft Office or Google Docs.
          </p>
          <a
            href={url}
            download={name}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Download size={16} /> Download {name}
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={officeViewerUrl}
      className="flex-1 w-full border-0"
      title="Office Viewer"
      style={{ minHeight: 0 }}
    />
  );
}

function TextRenderer({ url }: { url: string }) {
  const { blobUrl, loading, error } = useAuthBlobUrl(url, 'text/plain');
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!blobUrl) return;
    fetch(blobUrl).then(r => r.text()).then(setText).catch(() => setText('Failed to load file.'));
  }, [blobUrl]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="flex-1 overflow-auto p-6 bg-white">
      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
        {text ?? 'Loading…'}
      </pre>
    </div>
  );
}

function UnknownRenderer({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
      <File size={56} className="text-gray-400" />
      <div>
        <p className="text-gray-700 font-medium text-lg mb-1">{name}</p>
        <p className="text-gray-500 text-sm mb-4">Preview not available for this file type.</p>
        <a
          href={url}
          download={name}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Download size={16} /> Download
        </a>
      </div>
    </div>
  );
}

// ── Main FileViewer ───────────────────────────────────────────────────────────

export default function FileViewer({ files, initialIndex = 0, onClose }: FileViewerProps) {
  const [index, setIndex] = useState(Math.min(initialIndex, files.length - 1));
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const file = files[index];
  const mime = getMime(file);
  const kind = getKind(mime);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && files.length > 1) setIndex(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight' && files.length > 1) setIndex(i => Math.min(files.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [files.length, onClose]);

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        className={`bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          fullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl'
        }`}
        style={fullscreen ? {} : { height: 'min(90vh, 800px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
          <FileIcon mime={mime} />
          <span className="flex-1 text-sm font-medium text-gray-800 truncate">{file.name}</span>

          {/* file tabs if multiple */}
          {files.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => setIndex(i => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-gray-500">{index + 1} / {files.length}</span>
              <button
                onClick={() => setIndex(i => Math.min(files.length - 1, i + 1))}
                disabled={index === files.length - 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <a
            href={file.url}
            download={file.name}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title="Download"
          >
            <Download size={16} />
          </a>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── File thumbnail strip (if multiple) ── */}
        {files.length > 1 && (
          <div className="flex gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto flex-shrink-0 bg-gray-50">
            {files.map((f, i) => {
              const m = getMime(f);
              return (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    i === index
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <FileIcon mime={m} />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {kind === 'image' && <ImageRenderer url={file.url} name={file.name} mime={mime} />}
          {kind === 'video' && <VideoRenderer url={file.url} name={file.name} mime={mime} />}
          {kind === 'pdf'   && <PdfRenderer url={file.url} />}
          {kind === 'office' && <OfficeRenderer url={file.url} name={file.name} />}
          {kind === 'text'  && <TextRenderer url={file.url} />}
          {kind === 'unknown' && <UnknownRenderer url={file.url} name={file.name} />}
        </div>
      </div>

      {/* click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
