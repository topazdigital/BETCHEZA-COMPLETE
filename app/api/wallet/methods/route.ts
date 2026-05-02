import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet } from '@/lib/file-store';

export const dynamic = 'force-dynamic';

interface PaymentGateway {
  id: string;
  name: string;
  type: 'card' | 'mobile_money' | 'bank' | 'crypto' | 'ewallet' | 'regional';
  enabled: boolean;
  countries: string[];
  currencies: string[];
  logoUrl?: string;
  minAmount?: number;
  maxAmount?: number;
  fees?: { percent: number; fixed: number; currency: string };
  supportsPayouts: boolean;
}

export async function GET(req: NextRequest) {
  const gateways = fileStoreGet<PaymentGateway[]>('payment-gateways', []);
  const active = gateways
    .filter(g => g.enabled)
    .map(g => ({
      id: g.id,
      name: g.name,
      type: g.type,
      countries: g.countries,
      currencies: g.currencies,
      logoUrl: g.logoUrl,
      minAmount: g.minAmount,
      maxAmount: g.maxAmount,
      fees: g.fees,
      supportsPayouts: g.supportsPayouts,
    }));
  return NextResponse.json({ gateways: active });
}
