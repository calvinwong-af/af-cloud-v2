import { useRouter } from 'next/navigation';
import { applyBookingConfirmationAction, applyAWBAction, updateShipmentFromBLAction } from '@/app/actions/shipments-write';
import { uploadShipmentFileAction } from '@/app/actions/shipments-files';
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
  setPendingBLFile: (f: File | null) => void;
}): (docType: DocType, data: ParsedBCData | ParsedAWBData | ParsedBL, file: File | null) => Promise<{ ok: boolean; error?: string } | void> {
  const {
    order,
    loadOrder,
    loadRouteTimings,
    router,
    setFilesRefreshKey,
  } = params;

  return async (docType: DocType, data, uploadedFile) => {
    if (docType === 'BL') {
      const bl = data as unknown as Record<string, unknown>;
      const s = (v: unknown) => (v != null ? String(v) : '');

      const formData = new FormData();
      if (s(bl.waybill_number))              formData.append('waybill_number',       s(bl.waybill_number));
      if (s(bl.carrier_agent ?? bl.carrier)) formData.append('carrier_agent',        s(bl.carrier_agent ?? bl.carrier));
      if (s(bl.vessel_name))                 formData.append('vessel_name',          s(bl.vessel_name));
      if (s(bl.voyage_number))               formData.append('voyage_number',        s(bl.voyage_number));
      if (s(bl.on_board_date))               formData.append('etd',                  s(bl.on_board_date));
      if (s(bl.shipper_name))                formData.append('shipper_name',         s(bl.shipper_name));
      if (s(bl.shipper_address))             formData.append('shipper_address',      s(bl.shipper_address));
      if (s(bl.consignee_name))              formData.append('consignee_name',       s(bl.consignee_name));
      if (s(bl.consignee_address))           formData.append('consignee_address',    s(bl.consignee_address));
      if (s(bl.notify_party_name))           formData.append('notify_party_name',    s(bl.notify_party_name));
      if (s(bl.cargo_description))           formData.append('cargo_description',    s(bl.cargo_description));
      if (s(bl.total_weight_kg))             formData.append('total_weight_kg',      s(bl.total_weight_kg));
      if (s(bl.lcl_container_number))        formData.append('lcl_container_number', s(bl.lcl_container_number));
      if (s(bl.lcl_seal_number))             formData.append('lcl_seal_number',      s(bl.lcl_seal_number));
      // Raw parsed values → stored in bl_document for diff tracking
      if (s(bl.shipper_name))                formData.append('bl_shipper_name',      s(bl.shipper_name));
      if (s(bl.shipper_address))             formData.append('bl_shipper_address',   s(bl.shipper_address));
      if (s(bl.consignee_name))              formData.append('bl_consignee_name',    s(bl.consignee_name));
      if (s(bl.consignee_address))           formData.append('bl_consignee_address', s(bl.consignee_address));
      if (s(bl.pol_code))                    formData.append('origin_port',          s(bl.pol_code));
      if (s(bl.pod_code))                    formData.append('dest_port',            s(bl.pod_code));
      if (s(bl.pol_terminal))                formData.append('origin_terminal',      s(bl.pol_terminal));
      if (s(bl.pod_terminal))                formData.append('dest_terminal',        s(bl.pod_terminal));
      const containers = bl.containers as Array<Record<string, unknown>> | null;
      if (containers?.length)
        formData.append('containers', JSON.stringify(containers));
      const cargoItems = bl.cargo_items as Array<Record<string, unknown>> | null;
      if (cargoItems?.length)
        formData.append('cargo_items', JSON.stringify(cargoItems));
      if (uploadedFile)
        formData.append('file', uploadedFile, uploadedFile.name);

      const result = await updateShipmentFromBLAction(order.quotation_id, formData);
      if (!result || !result.success) {
        return { ok: false, error: result?.error ?? 'Apply failed' };
      }
      await Promise.all([loadOrder(), loadRouteTimings()]);
      router.refresh();
      setFilesRefreshKey(k => k + 1);
      return { ok: true };
    }

    if (docType === 'BOOKING_CONFIRMATION') {
      const bcData = data as ParsedBCData;
      // Map shipper/booking_party to shipper_name for bl_document diff tracking
      const bcPayload = {
        ...bcData,
        shipper_name: bcData.shipper || bcData.booking_party || null,
      };
      const result = await applyBookingConfirmationAction(order.quotation_id, bcPayload);
      if (!result || !result.success) {
        return { ok: false, error: result?.error ?? 'Apply failed' };
      }
      await Promise.all([loadOrder(), loadRouteTimings()]);
      router.refresh();
      // Save the uploaded document to Files using the proven upload endpoint
      if (uploadedFile) {
        const fd = new FormData();
        fd.append('file', uploadedFile, uploadedFile.name);
        fd.append('file_tags', JSON.stringify(['bc']));
        const saveResult = await uploadShipmentFileAction(order.quotation_id, fd);
        if (!saveResult || !saveResult.success) {
          console.error('[DocumentParse] BC file save failed:', saveResult);
        } else {
          setFilesRefreshKey(k => k + 1);
        }
      } else {
        console.error('[DocumentParse] BC uploadedFile is null — cannot save to Files');
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
      // Save the uploaded document to Files using the proven upload endpoint
      if (uploadedFile) {
        const fd = new FormData();
        fd.append('file', uploadedFile, uploadedFile.name);
        fd.append('file_tags', JSON.stringify(['awb']));
        const saveResult = await uploadShipmentFileAction(order.quotation_id, fd);
        if (!saveResult || !saveResult.success) {
          console.error('[DocumentParse] AWB file save failed:', saveResult);
        } else {
          setFilesRefreshKey(k => k + 1);
        }
      } else {
        console.error('[DocumentParse] AWB uploadedFile is null — cannot save to Files');
      }
      return { ok: true };
    }
  };
}
