import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { requireAdmin } from '@/lib/admin-auth';

export interface AdSlot {
  enabled: boolean;
  type: 'adsense' | 'custom';
  slotId?: string;
  customHtml?: string;
  label?: string;
}

export interface AdsConfig {
  enabled: boolean;
  adsense: {
    publisherId: string;
    autoAds: boolean;
  };
  slots: {
    header: AdSlot;
    sidebar: AdSlot;
    betweenMatches: AdSlot;
    matchDetail: AdSlot;
    footer: AdSlot;
    [key: string]: AdSlot;
  };
}

const DEFAULT_CONFIG: AdsConfig = {
  enabled: false,
  adsense: {
    publisherId: '',
    autoAds: false,
  },
  slots: {
    header: { enabled: false, type: 'adsense', slotId: '', label: 'Header Banner (728×90)' },
    sidebar: { enabled: false, type: 'adsense', slotId: '', label: 'Sidebar (300×250)' },
    betweenMatches: { enabled: false, type: 'adsense', slotId: '', label: 'In-Feed / Between Matches (320×100)' },
    matchDetail: { enabled: false, type: 'adsense', slotId: '', label: 'Match Detail Page (300×250)' },
    footer: { enabled: false, type: 'adsense', slotId: '', label: 'Footer Banner (728×90)' },
  },
};

export function getAdsConfig(): AdsConfig {
  return fileStoreGet<AdsConfig>('ads-config', DEFAULT_CONFIG);
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getAdsConfig());
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const current = getAdsConfig();
    const updated: AdsConfig = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      adsense: {
        publisherId: typeof body.adsense?.publisherId === 'string' ? body.adsense.publisherId : current.adsense.publisherId,
        autoAds: typeof body.adsense?.autoAds === 'boolean' ? body.adsense.autoAds : current.adsense.autoAds,
      },
      slots: { ...current.slots },
    };

    for (const slotKey of Object.keys(current.slots)) {
      if (body.slots?.[slotKey]) {
        updated.slots[slotKey] = {
          ...current.slots[slotKey],
          ...body.slots[slotKey],
        };
      }
    }

    fileStoreSet('ads-config', updated);
    return NextResponse.json({ success: true, config: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
