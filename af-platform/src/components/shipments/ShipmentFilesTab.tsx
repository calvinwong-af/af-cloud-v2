'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, Image as ImageIcon, File as FileIcon, Eye, EyeOff,
  Pencil, Trash2, Download, X, Loader2, AlertTriangle, Check, RefreshCw,
} from 'lucide-react';
import {
  getShipmentFilesAction,
  getFileTagsAction,
  uploadShipmentFileAction,
  updateShipmentFileAction,
  deleteShipmentFileAction,
  getFileDownloadUrlAction,
  reparseBlFileAction,
} from '@/app/actions/shipments-files';
import type { ShipmentFile, FileTag } from '@/app/actions/shipments-files';
import BLUpdateModal, { type ParsedBL } from '@/components/shipments/BLUpdateModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShipmentFilesTabProps {
  shipmentId: string;
  userRole: string; // AFU | AFC_ADMIN | AFC_MANAGER | AFC_USER
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return <FileText className="w-5 h-5 text-red-500" />;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  return <FileIcon className="w-5 h-5 text-[var(--text-muted)]" />;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const TAG_COLORS: Record<string, string> = {
  bl: 'bg-blue-100 text-blue-700',
  hbl: 'bg-indigo-100 text-indigo-700',
  invoice: 'bg-emerald-100 text-emerald-700',
  packing_list: 'bg-amber-100 text-amber-700',
  customs: 'bg-purple-100 text-purple-700',
  certificate: 'bg-teal-100 text-teal-700',
};

function tagStyle(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
}

const isAFU = (role: string) => role === 'AFU' || role.startsWith('AFU');
const canUpload = (role: string) => isAFU(role) || role === 'AFC_ADMIN' || role === 'AFC_MANAGER' || role === 'AFC-ADMIN' || role === 'AFC-M';
const canEditTags = (role: string) => canUpload(role);
const canDelete = (role: string) => isAFU(role);
const canToggleVisibility = (role: string) => isAFU(role);

// ─── Component ───────────────────────────────────────────────────────────────

export default function ShipmentFilesTab({ shipmentId, userRole }: ShipmentFilesTabProps) {
  const [files, setFiles] = useState<ShipmentFile[]>([]);
  const [tags, setTags] = useState<FileTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingFileId, setEditingFileId] = useState<number | null>(null);
  const [reparsingFileId, setReparsingFileId] = useState<number | null>(null);
  const [reparseError, setReparseError] = useState<string | null>(null);
  const [blParsedData, setBlParsedData] = useState<ParsedBL | null>(null);
  const [showBLModal, setShowBLModal] = useState(false);

  const loadFiles = useCallback(async () => {
    const result = await getShipmentFilesAction(shipmentId);
    if (!result) return;
    if (result.success) {
      setFiles(result.data);
    } else {
      setError(result.error);
    }
  }, [shipmentId]);

  const loadTags = useCallback(async () => {
    const result = await getFileTagsAction();
    if (!result) return;
    if (result.success) setTags(result.data);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([loadFiles(), loadTags()]);
      setLoading(false);
    }
    load();
  }, [loadFiles, loadTags]);

  const handleDownload = useCallback(async (fileId: number) => {
    const result = await getFileDownloadUrlAction(shipmentId, fileId);
    if (!result) return;
    if (result.success) {
      window.open(result.download_url, '_blank');
    }
  }, [shipmentId]);

  const handleDelete = useCallback(async (fileId: number) => {
    if (!confirm('Delete this file?')) return;
    const result = await deleteShipmentFileAction(shipmentId, fileId);
    if (!result) return;
    if (result.success) {
      setFiles(prev => prev.filter(f => f.file_id !== fileId));
    }
  }, [shipmentId]);

  const handleVisibilityToggle = useCallback(async (file: ShipmentFile) => {
    const result = await updateShipmentFileAction(shipmentId, file.file_id, {
      visibility: !file.visibility,
    });
    if (!result) return;
    if (result.success) {
      setFiles(prev => prev.map(f => f.file_id === file.file_id ? result.data : f));
    }
  }, [shipmentId]);

  const handleReparse = useCallback(async (fileId: number) => {
    setReparsingFileId(fileId);
    setReparseError(null);
    try {
      const result = await reparseBlFileAction(shipmentId, fileId);
      if (!result) {
        setReparseError('No response from server');
        setReparsingFileId(null);
        return;
      }
      if (!result.success) {
        setReparseError(result.error);
        setReparsingFileId(null);
        return;
      }

      const data = result.data as { parsed: ParsedBL };
      setBlParsedData(data.parsed);
      setShowBLModal(true);
      setReparsingFileId(null);
    } catch {
      setReparseError('Failed to re-parse BL');
      setReparsingFileId(null);
    }
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--sky)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Files</h3>
        {canUpload(userRole) && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 transition-opacity"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Files list */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">No files uploaded yet</p>
          {canUpload(userRole) && (
            <button
              onClick={() => setShowUpload(true)}
              className="mt-2 text-xs text-[var(--sky)] hover:underline"
            >
              Upload a file
            </button>
          )}
        </div>
      ) : (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)]">
          {files.map(file => (
            <div key={file.file_id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-[var(--surface)] transition-colors">
              {/* Icon */}
              <div className="flex-shrink-0">{getFileIcon(file.file_name)}</div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleDownload(file.file_id)}
                  className="text-sm font-medium text-[var(--text)] hover:text-[var(--sky)] hover:underline truncate block max-w-full text-left"
                >
                  {file.file_name}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[var(--text-muted)]">{formatFileSize(file.file_size)}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-xs text-[var(--text-muted)]">{file.user}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(file.created)}</span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {(file.file_tags ?? []).map(tag => (
                  <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tagStyle(tag)}`}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* Reparse error */}
              {reparseError && reparsingFileId === null && (
                <div className="text-[10px] text-red-500 flex-shrink-0">{reparseError}</div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAFU(userRole) && (file.file_tags ?? []).includes('bl') && (
                  <button
                    onClick={() => handleReparse(file.file_id)}
                    disabled={reparsingFileId !== null}
                    className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors disabled:opacity-50"
                    title="Read file again"
                  >
                    {reparsingFileId === file.file_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span className="text-xs">Read file again</span>
                  </button>
                )}
                {canToggleVisibility(userRole) && (
                  <button
                    onClick={() => handleVisibilityToggle(file)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                    title={file.visibility ? 'Visible to customer' : 'Hidden from customer'}
                  >
                    {file.visibility ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                )}
                {canEditTags(userRole) && (
                  <button
                    onClick={() => setEditingFileId(file.file_id)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                    title="Edit tags"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDownload(file.file_id)}
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--sky)] hover:bg-[var(--sky-pale)] transition-colors"
                  title="Download"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {canDelete(userRole) && (
                  <button
                    onClick={() => handleDelete(file.file_id)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          shipmentId={shipmentId}
          tags={tags}
          userRole={userRole}
          onClose={() => setShowUpload(false)}
          onUploaded={(file) => {
            setFiles(prev => [file, ...prev]);
            setShowUpload(false);
          }}
        />
      )}

      {/* Edit tags modal */}
      {editingFileId !== null && (
        <EditTagsModal
          shipmentId={shipmentId}
          file={files.find(f => f.file_id === editingFileId)!}
          tags={tags}
          onClose={() => setEditingFileId(null)}
          onSaved={(updated) => {
            setFiles(prev => prev.map(f => f.file_id === updated.file_id ? updated : f));
            setEditingFileId(null);
          }}
        />
      )}

      {/* BL re-parse modal */}
      {showBLModal && blParsedData && (
        <BLUpdateModal
          shipmentId={shipmentId}
          onClose={() => {
            setShowBLModal(false);
            setBlParsedData(null);
          }}
          onSuccess={() => {
            setShowBLModal(false);
            setBlParsedData(null);
          }}
          initialParsed={blParsedData}
          skipFileSave
        />
      )}
    </div>
  );
}

// ─── Upload Modal ────────────────────────────────────────────────────────────

function UploadModal({
  shipmentId, tags, userRole, onClose, onUploaded,
}: {
  shipmentId: string;
  tags: FileTag[];
  userRole: string;
  onClose: () => void;
  onUploaded: (file: ShipmentFile) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size exceeds 20 MB limit');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('file_tags', JSON.stringify(selectedTags));
    formData.append('visibility', String(visibility));

    const result = await uploadShipmentFileAction(shipmentId, formData);
    setUploading(false);

    if (!result) {
      setError('No response from server');
      return;
    }
    if (result.success) {
      onUploaded(result.data);
    } else {
      setError(result.error);
    }
  }, [selectedFile, selectedTags, visibility, shipmentId, onUploaded]);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Upload File</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) setSelectedFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--sky)] bg-[var(--sky-mist)]'
              : selectedFile
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-[var(--border)] hover:border-[var(--sky)] hover:bg-[var(--sky-mist)]'
          }`}
        >
          {selectedFile ? (
            <>
              {getFileIcon(selectedFile.name)}
              <p className="text-sm font-medium text-[var(--text)]">{selectedFile.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatFileSize(selectedFile.size / 1024)}</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-xs text-[var(--text-mid)]">
                Drop file here or <span className="text-[var(--sky)] font-medium">browse</span>
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">Max 20 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) setSelectedFile(f);
          }}
        />

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-mid)] mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => {
                const name = tag.tag_name || tag.tag_id;
                const selected = selectedTags.includes(name);
                return (
                  <button
                    key={tag.tag_id}
                    onClick={() => toggleTag(name)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                      selected
                        ? 'border-[var(--sky)] bg-[var(--sky-pale)] text-[var(--sky)]'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--sky)]'
                    }`}
                  >
                    {tag.tag_label || name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Visibility */}
        {canToggleVisibility(userRole) && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--text-mid)]">Visible to customer</label>
            <button
              onClick={() => setVisibility(!visibility)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                visibility ? 'bg-[var(--sky)]' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                visibility ? 'left-[18px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Tags Modal ─────────────────────────────────────────────────────────

function EditTagsModal({
  shipmentId, file, tags, onClose, onSaved,
}: {
  shipmentId: string;
  file: ShipmentFile;
  tags: FileTag[];
  onClose: () => void;
  onSaved: (file: ShipmentFile) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>(file.file_tags ?? []);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName],
    );
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    const result = await updateShipmentFileAction(shipmentId, file.file_id, {
      file_tags: selectedTags,
    });
    setSaving(false);

    if (!result) return;
    if (result.success) {
      onSaved(result.data);
    }
  }, [shipmentId, file.file_id, selectedTags, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">Edit Tags</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] truncate">{file.file_name}</p>

        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => {
            const name = tag.tag_name || tag.tag_id;
            const selected = selectedTags.includes(name);
            return (
              <button
                key={tag.tag_id}
                onClick={() => toggleTag(name)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                  selected
                    ? 'border-[var(--sky)] bg-[var(--sky-pale)] text-[var(--sky)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--sky)]'
                }`}
              >
                {selected && <Check className="w-3 h-3 inline mr-0.5" />}
                {tag.tag_label || name}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--sky)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
