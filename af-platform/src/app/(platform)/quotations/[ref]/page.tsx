import { QuotationDetail } from './_components';

export default function QuotationDetailPage({ params }: { params: { ref: string } }) {
  return <QuotationDetail quotationRef={params.ref} />;
}
