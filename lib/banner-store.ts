import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface Banner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  section: 'competitions' | 'daily-tips' | 'general';
  position: 'sidebar' | 'mobile' | 'both';
  order: number;
  gradient: string;
  ctaText: string;
}

const DATA_DIR = path.join(process.cwd(), '.local', 'data');
const BANNERS_FILE = path.join(DATA_DIR, 'banners.json');

export const DEFAULT_BANNERS: Banner[] = [
  {
    id: 'competitions',
    title: 'Win KES 50,000',
    description: 'Join our weekly competition and compete with top tipsters for a massive prize pool!',
    imageUrl: '',
    linkUrl: '/competitions',
    active: true,
    section: 'competitions',
    position: 'both',
    order: 0,
    gradient: 'from-amber-500 to-orange-600',
    ctaText: 'Enter Now',
  },
  {
    id: 'daily-tips',
    title: '3 Daily Expert Tips',
    description: 'AI-powered picks delivered every morning. Track record of 68%+ win rate.',
    imageUrl: '',
    linkUrl: '/strategy',
    active: true,
    section: 'daily-tips',
    position: 'both',
    order: 1,
    gradient: 'from-blue-600 to-indigo-700',
    ctaText: 'View Today\'s Tips',
  },
  {
    id: 'tipsters',
    title: 'Top Verified Tipsters',
    description: 'Follow tipsters with proven 70%+ win rates. Free to follow.',
    imageUrl: '',
    linkUrl: '/tipsters',
    active: true,
    section: 'general',
    position: 'sidebar',
    order: 2,
    gradient: 'from-emerald-500 to-teal-600',
    ctaText: 'Browse Tipsters',
  },
];

export async function getBanners(): Promise<Banner[]> {
  try {
    const raw = await readFile(BANNERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_BANNERS;
  } catch {
    return DEFAULT_BANNERS;
  }
}

export async function saveBanners(banners: Banner[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(BANNERS_FILE, JSON.stringify(banners, null, 2), 'utf-8');
}
