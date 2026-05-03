'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkX, Clock, Trophy, Loader2, LogIn, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MatchCardNew } from '@/components/matches/match-card-new';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useMatches } from '@/lib/hooks/use-matches';
import type { Match } from '@/lib/api/sports-api';
import { cn } from '@/lib/utils';
import { isLiveMatchStatus } from '@/lib/utils/live-status';

interface BookmarkItem {
  entity_type: string;
  entity_id: string;
  created_at: string;
}

type FilterTab = 'all' | 'live' | 'upcoming' | 'finished';
