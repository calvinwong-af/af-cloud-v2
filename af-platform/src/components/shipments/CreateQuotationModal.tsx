'use client';

import ScopeConfigModal from '@/components/shared/ScopeConfigModal';

interface CreateQuotationModalProps {
  shipmentId: string;
  orderType: string;
  incoterm: string;
  transactionType: string;
  containerSummary?: string | null;
  containerSizes?: string[];
  containerNumbers?: string[];
  originPortCode?: string | null;
  originPortName?: string | null;
  destinationPortCode?: string | null;
  destinationPortName?: string | null;
  onClose: () => void;
  onCreated: (quotationRef: string) => void;
}

export default function CreateQuotationModal({
  shipmentId, orderType, incoterm, transactionType,
  containerSummary, containerSizes, containerNumbers,
  originPortCode, originPortName, destinationPortCode, destinationPortName,
  onClose, onCreated,
}: CreateQuotationModalProps) {
  return (
    <ScopeConfigModal
      shipmentId={shipmentId}
      orderType={orderType}
      incoterm={incoterm}
      transactionType={transactionType}
      containerSummary={containerSummary}
      containerSizes={containerSizes}
      containerNumbers={containerNumbers}
      originPortCode={originPortCode}
      originPortName={originPortName}
      destinationPortCode={destinationPortCode}
      destinationPortName={destinationPortName}
      mode="create-quotation"
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}
