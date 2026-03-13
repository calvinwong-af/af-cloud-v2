import { QuotationDetail } from './_components';
import { verifySessionAndRole } from '@/lib/auth-server';

export default async function QuotationDetailPage({ params }: { params: { ref: string } }) {
  const session = await verifySessionAndRole(['AFU-ADMIN', 'AFU-STAFF', 'AFC-ADMIN', 'AFC-M']);
  const accountType = session.valid ? session.account_type : 'AFC';
  return <QuotationDetail quotationRef={params.ref} accountType={accountType} />;
}
