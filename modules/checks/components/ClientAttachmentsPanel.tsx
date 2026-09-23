'use client';
/**
 * ClientAttachmentsPanel
 * Upload / list / download / delete files for a client.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface FileEntry {
  name:      string;
  size:      number;
  createdAt: string | null;
  url:       string | null;
  path:      string;
}

interface Props {
  clientCode: string;
  clientName: string;
  canUpload:  boolean;
}

function fmtSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  if (['zip','rar','7z'].includes(ext)) return '🗜️';
  return '📎';
}

export default function ClientAttachmentsPanel({ clientCode, clientName, canUpload }: Props) {
  const [files,     setFiles]     = useState<FileEntry[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [open,      setOpen]      = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/attachments/${encodeURIComponent(clientCode)}`);
      const json = await res.json();
      if (json.ok) setFiles(json.files ?? []);
      else setError(json.error ?? 'Failed to load files');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [clientCode]);

  useEffect(() => {
    if (open) fetchFiles();
  }, [open, fetchFiles]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`/api/attachments/${encodeURIComponent(clientCode)}`, {
        method: 'POST',
        body:   form,
      });
      const json = await res.json();
      if (json.ok) await fetchFiles();
      else setError(json.error ?? 'Upload failed');
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    setDeleting(filename);
    try {
      const res  = await fetch(
        `/api/attachments/${encodeURIComponent(clientCode)}/${encodeURIComponent(filename)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (json.ok) setFiles(prev => prev.filter(f => f.name !== filename));
      else setError(json.error ?? 'Delete failed');
    } catch {
      setError('Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
      >
        <span>📎</span>
        <span>Attachments{files.length > 0 && !open ? ` (${files.length})` : ''}</span>
        <span className="text-gray-400">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Drop zone / Upload area */}
          {canUpload && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-4 py-3 text-center cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              {uploading ? (
                <p className="text-xs text-blue-600 font-semibold">⏳ Uploading…</p>
              ) : (
                <p className="text-xs text-gray-500">
                  {dragOver ? '📂 Drop to upload' : '📎 Click or drag & drop to attach a file'}
                </p>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handlePick}
          />

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠ {error}
            </p>
          )}

          {/* File list */}
          {loading ? (
            <p className="text-xs text-gray-400 italic">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No attachments yet.</p>
          ) : (
            <div className="space-y-1.5">
              {files.map(f => (
                <div key={f.name} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2 hover:border-gray-200 transition-colors">
                  <span className="text-base shrink-0">{fileIcon(f.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate" title={f.name}>
                      {f.name.replace(/^\d+_/, '')}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmtSize(f.size)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Download
                      </a>
                    )}
                    {canUpload && (
                      <button
                        type="button"
                        disabled={deleting === f.name}
                        onClick={() => handleDelete(f.name)}
                        className="text-[11px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        {deleting === f.name ? '…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
