import { useRouter } from 'next/navigation';
import { applyBookingConfirmationAction, applyAWBAction } from '@/app/actions/shipments-write';
import { saveDocumentFileAction } from '@/app/actions/shipments-files';
import type { DocType, ParsedBCData, ParsedAWBData } from '@/app/actions/shipments-files';
import type { ParsedBL } from '@/components/shipments/BLUpdateModal';
import type { ShipmentOrder } from '@/lib/types';

export function createDocResultHandler(params: {
  quotationId: string;
  companyId: string | null | undefined;
  order: ShipmentOrder;
  loadOrder: () => Promise<void>;
  loadRouteTimings: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
  setShowDocParseModal: (v: boolean) => void;
  setDocParseBLData: (v: ParsedBL | null) => void;
  setShowBLModal: (v: boolean) => void;
  setFilesRefreshKey: (fn: (k: number) => number) => void;
}): (docType: DocType, data: ParsedBCData | ParsedAWBData | ParsedBL, file: File | null) => Promise<{ ok: boolean; error?: string } | void> {
  const {
    order,
    loadOrder,
    loadRouteTimings,
    router,
    setShowDocParseModal,
    setDocParseBLData,
    setShowBLModal,
    setFilesRefreshKey,
  } = params;

  return async (docType: DocType, data, uploadedFile) => {
    if (docType === 'BL') {
      // BL: close this modal and open BLUpdateModal — no loading state needed
      setShowDocParseModal(false);
      setDocParseBLData(data as ParsedBL);
      setShowBLModal(true);
      return;
    }

    if (docType === 'BOOKING_CONFIRMATION') {
      const result = await applyBookingConfirmationAction(order.quotation_id, data as ParsedBCData);
      if (!result || !result.success) {
        return { ok: false, error: result?.error ?? 'Apply failed' };
      }
      await Promise.all([loadOrder(), loadRouteTimings()]);
      router.refresh();
      // Save the uploaded document to Files (non-critical)
      if (uploadedFile) {
        const fd = new FormData();
        fd.append('file', uploadedFile, uploadedFile.name);
        fd.append('doc_type', 'BC');
        const saveResult = await saveDocumentFileAction(order.quotation_id, fd);
        if (!saveResult || !saveResult.success) {
          console.error('[DocumentParse] BC file save failed:', saveResult?.error);
        } else {
          setFilesRefreshKey(k => k + 1);
        }
      }
      return { ok: true };
    }

    if (docType === 'AWB') {
      const result = await applyAWBAction(order.quotation_id, data as ParsedAWBData);
      if (!result || !result.success) {
        return { ok: false, error: result?.error ?? 'Apply failed' };
      }
      await Promise.all([loadOrder(), loadRouteTimings()]);
      router.refresh();
      // Save the uploaded document to Files (non-critical)
      if (uploadedFile) {
        const fd = new FormData();
        fd.append('file', uploadedFile, uploadedFile.name);
        fd.append('doc_type', 'AWB');
        const saveResult = await saveDocumentFileAction(order.quotation_id, fd);
        if (!saveResult || !saveResult.success) {
          console.error('[DocumentParse] AWB file save failed:', saveResult?.error);
        } else {
          setFilesRefreshKey(k => k + 1);
        }
      }
      return { ok: true };
    }
  };
}
