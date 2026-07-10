/**
 * DocViewer — Custom lightweight document viewer
 *
 * Supports: PDF, XLSX/XLS/CSV, DOCX/DOC, images, plain text
 * Uses:
 *   - pdfjs-dist  → renders PDF pages to <canvas> (no iframe)
 *   - xlsx        → parses spreadsheets to a table
 *   - mammoth     → converts DOCX to HTML
 *   - fetch() + Authorization header for all downloads (no token in URL)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Download, ZoomIn, ZoomOut, RotateCcw,
  ChevronLeft, ChevronRight, File, FileText,
  Image as ImageIcon, FileSpreadsheet, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ViewerAttachment {
  id: number;
  original_filename: string;
  file_size: number;
  mime_type: string;
  uploader_name: string;
  uploaded_at: string;
}

interface DocViewerProps {
  attachment: ViewerAttachment;
  /** Authenticated fetch function that returns an ArrayBuffer */
  fetchFile: (id: number) => Promise<ArrayBuffer>;
  /** URL to trigger a download (with auth) */
  downloadUrl: string;
  onClose: () => void;
}

type ViewerState = 'loading' | 'ready' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getCategory(mimeType: string): 'pdf' | 'image' | 'spreadsheet' | 'word' | 'text' | 'unsupported' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType === 'text/csv'
  ) return 'spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  if (mimeType === 'text/plain') return 'text';
  return 'unsupported';
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const cls = className ?? 'w-5 h-5';
  const cat = getCategory(mimeType);
  if (cat === 'image') return <ImageIcon className={cls} />;
  if (cat === 'pdf' || cat === 'text') return <FileText className={cls} />;
  if (cat === 'spreadsheet') return <FileSpreadsheet className={cls} />;
  return <File className={cls} />;
}

// ─── PDF Viewer ───────────────────────────────────────────────────────────────

interface PdfViewerProps {
  buffer: ArrayBuffer;
  zoom: number;
}

function PdfViewer({ buffer, zoom }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<ImageData[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderPage = useCallback(
    async (pdf: unknown, pageNum: number, scale: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page = await (pdf as any).getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // Point worker to the bundled worker file
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setCurrentPage(1);
        setRendering(false);
        // Store pdf in ref for page navigation
        (containerRef.current as unknown as { __pdf: typeof pdf }).__pdf = pdf;
      } catch {
        if (!cancelled) setRendering(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [buffer]);

  // Re-render when page or zoom changes
  useEffect(() => {
    if (rendering) return;
    const pdf = (containerRef.current as unknown as { __pdf: unknown })?.__pdf;
    if (!pdf) return;
    renderPage(pdf, currentPage, zoom);
  }, [currentPage, zoom, rendering, renderPage]);

  return (
    <div ref={containerRef} className="flex flex-col items-center h-full overflow-auto bg-neutral-950 py-4">
      {rendering ? (
        <div className="flex items-center gap-2 text-neutral-400 mt-16">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Rendering PDF…</span>
        </div>
      ) : (
        <>
          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center gap-3 mb-3 bg-neutral-800 px-3 py-1.5 rounded-full">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-neutral-300 tabular-nums select-none">
                Page {currentPage} / {pageCount}
              </span>
              <button
                disabled={currentPage >= pageCount}
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="shadow-2xl"
            style={{ maxWidth: '100%' }}
          />
        </>
      )}
    </div>
  );
}

// ─── Spreadsheet Viewer ───────────────────────────────────────────────────────

interface SheetViewerProps {
  buffer: ArrayBuffer;
  zoom: number;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

function SheetViewer({ buffer, zoom }: SheetViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

        const parsed: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const json: string[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: '',
            raw: false,
          }) as string[][];

          const nonEmpty = json.filter((row) => row.some((cell) => cell !== ''));
          const headers = nonEmpty[0] ?? [];
          const rows = nonEmpty.slice(1);
          return { name, headers: headers.map(String), rows: rows.map((r) => r.map(String)) };
        });

        setSheets(parsed);
      } catch {
        setError('Could not parse spreadsheet.');
      }
    };
    load();
  }, [buffer]);

  if (error) return <ErrorView message={error} />;
  if (sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Parsing spreadsheet…</span>
      </div>
    );
  }

  const sheet = sheets[activeSheet];

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 px-3 pt-2 shrink-0">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1 text-xs rounded-t border-b-2 transition-colors ${
                i === activeSheet
                  ? 'border-red-500 text-red-400 bg-neutral-800'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-3">
        <div style={{ fontSize: `${zoom * 14}px` }}>
          <table className="border-collapse text-left" style={{ minWidth: '100%' }}>
            {sheet.headers.length > 0 && (
              <thead>
                <tr>
                  {sheet.headers.map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-200 font-semibold border border-neutral-700 whitespace-nowrap"
                    >
                      {h || <span className="text-neutral-600">&nbsp;</span>}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {sheet.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(sheet.headers.length, 1)}
                    className="px-3 py-4 text-center text-neutral-500 border border-neutral-700"
                  >
                    No data rows
                  </td>
                </tr>
              ) : (
                sheet.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-950'}
                  >
                    {sheet.headers.map((_, ci) => (
                      <td
                        key={ci}
                        className="px-3 py-1.5 text-neutral-300 border border-neutral-800 whitespace-nowrap"
                      >
                        {row[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-xs text-neutral-600 mt-2">
            {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''} · {sheet.headers.length} column{sheet.headers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Word / DOCX Viewer ───────────────────────────────────────────────────────

interface WordViewerProps {
  buffer: ArrayBuffer;
  zoom: number;
}

function WordViewer({ buffer, zoom }: WordViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        setHtml(result.value);
      } catch {
        setError('Could not render document. Try downloading it instead.');
      }
    };
    load();
  }, [buffer]);

  if (error) return <ErrorView message={error} />;
  if (!html) {
    return (
      <div className="flex items-center justify-center h-32 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Converting document…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-neutral-100 p-1">
      <div
        className="max-w-3xl mx-auto bg-white shadow-sm rounded p-8 text-gray-800"
        style={{ fontSize: `${zoom * 15}px`, lineHeight: 1.7 }}
        // The HTML is generated by mammoth from a DOCX — it contains only structural
        // markup (headings, paragraphs, lists, tables) with no scripts.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ─── Image Viewer ─────────────────────────────────────────────────────────────

interface ImageViewerProps {
  buffer: ArrayBuffer;
  mimeType: string;
  filename: string;
  zoom: number;
}

function ImageViewer({ buffer, mimeType, filename, zoom }: ImageViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [buffer, mimeType]);

  if (!objectUrl) return null;

  return (
    <div className="flex-1 flex items-center justify-center overflow-auto bg-neutral-950 p-4">
      <img
        src={objectUrl}
        alt={filename}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
        className="max-w-full object-contain shadow-2xl"
        draggable={false}
      />
    </div>
  );
}

// ─── Text Viewer ──────────────────────────────────────────────────────────────

interface TextViewerProps {
  buffer: ArrayBuffer;
  zoom: number;
}

function PlainTextViewer({ buffer, zoom }: TextViewerProps) {
  const text = new TextDecoder('utf-8').decode(new Uint8Array(buffer));
  return (
    <div className="flex-1 overflow-auto bg-neutral-950 p-4">
      <pre
        className="text-neutral-300 whitespace-pre-wrap break-words"
        style={{ fontSize: `${zoom * 13}px` }}
      >
        {text}
      </pre>
    </div>
  );
}

// ─── Error View ───────────────────────────────────────────────────────────────

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-400 p-8">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

// ─── Main DocViewer ───────────────────────────────────────────────────────────

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3.0;

export default function DocViewer({ attachment, fetchFile, downloadUrl, onClose }: DocViewerProps) {
  const [state, setState] = useState<ViewerState>('loading');
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);

  const category = getCategory(attachment.mime_type);

  // Fetch file buffer on mount
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setBuffer(null);
    setError(null);
    setZoom(1.0);

    fetchFile(attachment.id)
      .then((buf) => {
        if (cancelled) return;
        setBuffer(buf);
        setState('ready');
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message ?? 'Failed to load file.');
        setState('error');
      });

    return () => { cancelled = true; };
  }, [attachment.id, fetchFile]);

  // Keyboard shortcuts: Escape = close, +/- = zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.key === '=' || e.key === '+') && e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))); }
      if (e.key === '-' && e.metaKey) { e.preventDefault(); setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const zoomIn  = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1.0);

  // For unsupported types, just offer download
  const isUnsupported = category === 'unsupported';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${attachment.original_filename}`}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
        {/* File info */}
        <FileTypeIcon mimeType={attachment.mime_type} className="w-4 h-4 text-neutral-400 shrink-0" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-neutral-200 truncate">
            {attachment.original_filename}
          </span>
          <span className="text-xs text-neutral-500 shrink-0 hidden sm:inline">
            {formatBytes(attachment.file_size)} · {attachment.uploader_name}
          </span>
        </div>

        {/* Zoom controls — hide for unsupported */}
        {!isUnsupported && state === 'ready' && (
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg px-2 py-1 shrink-0">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomReset}
              className="text-xs text-neutral-300 hover:text-white tabular-nums w-10 text-center transition-colors"
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              className="p-0.5 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomReset}
              className="p-0.5 text-neutral-400 hover:text-white transition-colors ml-1"
              aria-label="Reset zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Download */}
        <a
          href={downloadUrl}
          download={attachment.original_filename}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-neutral-700 text-neutral-300 hover:bg-neutral-600 transition-colors shrink-0"
          aria-label="Download file"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Download</span>
        </a>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors shrink-0"
          aria-label="Close viewer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Viewer body ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {state === 'loading' && (
          <div className="flex-1 flex items-center justify-center gap-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading file…</span>
          </div>
        )}

        {state === 'error' && <ErrorView message={error ?? 'Failed to load file.'} />}

        {state === 'ready' && buffer && (
          <>
            {category === 'pdf' && (
              <PdfViewer buffer={buffer} zoom={zoom} />
            )}
            {category === 'image' && (
              <ImageViewer
                buffer={buffer}
                mimeType={attachment.mime_type}
                filename={attachment.original_filename}
                zoom={zoom}
              />
            )}
            {category === 'spreadsheet' && (
              <SheetViewer buffer={buffer} zoom={zoom} />
            )}
            {category === 'word' && (
              <WordViewer buffer={buffer} zoom={zoom} />
            )}
            {category === 'text' && (
              <PlainTextViewer buffer={buffer} zoom={zoom} />
            )}
            {category === 'unsupported' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-400 p-8">
                <File className="w-14 h-14 text-neutral-600" />
                <p className="text-sm text-center max-w-xs">
                  This file type can't be previewed in the browser.
                  <br />Download it to open it locally.
                </p>
                <a
                  href={downloadUrl}
                  download={attachment.original_filename}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download {attachment.original_filename}
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
