'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShipmentFile {
  file_id: number;
  shipment_order_id: string;
  company_id: string;
  file_name: string;
  file_location: string;
  file_tags: string[];
  file_size: number; // KB
  visibility: boolean;
  notification_sent: boolean;
  user: string;
  created: string;
  updated: string;
}

export interface FileTag {
  tag_id: string;
  tag_name: string;
  tag_label: string;
  category: string;
}

type FilesResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getIdToken(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  return cookieStore.get('af-session')?.value ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/v2/shipments/{shipmentId}/files
// ---------------------------------------------------------------------------

export async function getShipmentFilesAction(
  shipmentId: string,
): Promise<FilesResult<ShipmentFile[]>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[getShipmentFilesAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load files' };
  }
}

// ---------------------------------------------------------------------------
// GET /api/v2/shipments/file-tags
// ---------------------------------------------------------------------------

export async function getFileTagsAction(): Promise<FilesResult<FileTag[]>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL('/api/v2/shipments/file-tags', serverUrl);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (err) {
    console.error('[getFileTagsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to load file tags' };
  }
}

// ---------------------------------------------------------------------------
// POST /api/v2/shipments/{shipmentId}/files
// ---------------------------------------------------------------------------

export async function uploadShipmentFileAction(
  shipmentId: string,
  formData: FormData,
): Promise<FilesResult<ShipmentFile>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[uploadShipmentFileAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to upload file' };
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v2/shipments/{shipmentId}/files/{fileId}
// ---------------------------------------------------------------------------

export async function updateShipmentFileAction(
  shipmentId: string,
  fileId: number,
  updates: { file_tags?: string[]; visibility?: boolean },
): Promise<FilesResult<ShipmentFile>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files/${fileId}`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[updateShipmentFileAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to update file' };
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v2/shipments/{shipmentId}/files/{fileId}
// ---------------------------------------------------------------------------

export async function deleteShipmentFileAction(
  shipmentId: string,
  fileId: number,
): Promise<{ success: true; deleted: boolean } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files/${fileId}`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    return { success: true, deleted: true };
  } catch (err) {
    console.error('[deleteShipmentFileAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to delete file' };
  }
}

// ---------------------------------------------------------------------------
// Re-parse BL — full server-side chain (no CORS issues)
// ---------------------------------------------------------------------------

export async function reparseBlFileAction(
  shipmentId: string,
  fileId: number,
): Promise<{ success: true; data: Record<string, unknown> } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    // 1. Get signed download URL from af-server
    const downloadUrl = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files/${fileId}/download`,
      serverUrl,
    );
    const downloadRes = await fetch(downloadUrl.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });
    if (!downloadRes.ok) {
      const json = await downloadRes.json().catch(() => null);
      return { success: false, error: json?.detail ?? 'Failed to get file URL' };
    }
    const { download_url } = await downloadRes.json();

    // 2. Fetch file bytes from signed URL (server-side — no CORS)
    const fileRes = await fetch(download_url);
    if (!fileRes.ok) {
      return { success: false, error: 'Failed to download file from storage' };
    }
    const fileBuffer = await fileRes.arrayBuffer();
    const contentType = fileRes.headers.get('content-type') || 'application/pdf';

    // 3. Forward to parse-bl endpoint
    const blob = new Blob([fileBuffer], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, 'bl.pdf');

    const parseUrl = new URL('/api/v2/shipments/parse-bl', serverUrl);
    const parseRes = await fetch(parseUrl.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
      cache: 'no-store',
    });

    if (!parseRes.ok) {
      const json = await parseRes.json().catch(() => null);
      return { success: false, error: json?.detail ?? 'Failed to parse BL' };
    }

    const parseJson = await parseRes.json();
    return { success: true, data: parseJson };
  } catch (err) {
    console.error('[reparseBlFileAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to re-parse BL' };
  }
}

// ---------------------------------------------------------------------------
// GET /api/v2/shipments/{shipmentId}/files/{fileId}/download
// ---------------------------------------------------------------------------

export async function getFileDownloadUrlAction(
  shipmentId: string,
  fileId: number,
): Promise<{ success: true; download_url: string } | { success: false; error: string }> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    const idToken = await getIdToken();
    if (!idToken) {
      return { success: false, error: 'No session token' };
    }

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'Server URL not configured' };
    }

    const url = new URL(
      `/api/v2/shipments/${encodeURIComponent(shipmentId)}/files/${fileId}/download`,
      serverUrl,
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const msg = json?.detail ?? json?.msg ?? `Server responded ${res.status}`;
      return { success: false, error: msg };
    }

    const json = await res.json();
    return { success: true, download_url: json.download_url };
  } catch (err) {
    console.error('[getFileDownloadUrlAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to get download URL' };
  }
}
