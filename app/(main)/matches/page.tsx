"use client"

import { useMemo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, Calendar, Clock, Radio, ArrowLeft } from 'lucide-react';
import { useMatches } from '@/lib/hooks/use-matches';
import { isLiveMatchStatus } from '@/lib/utils/live-status';

export default function MatchesPage() {
  const searchParams = useSearchParams();
  const { matches, allMatches, isLoading, error } = useMatches();
  const statusFilter = searchParams.get('status') || 'all';
  const leagueFilter = searchParams.get('league') || 'all';
  const search = searchParams.get('search') || '';
  const selectedSportId = searchParams.get('sport') ? Number(searchParams.get('sport')) : null;
  const dateTab = searchParams.get('date') || 'today';
  const calendarDate = searchParams.get('calendarDate') || null;

  const filteredMatches = useMemo(() => {
    let result = matches.filter(m => !isLiveMatchStatus(m.status) && m.status !== 'finished');
    const todayKey = new Date().toISOString().slice(0, 10);
    if (statusFilter !== 'live') {
      if (dateTab === 'today') {
        result = result.filter(m => new Date(m.kickoffTime).toISOString().slice(0, 10) === todayKey);
      } else if (dateTab === 'upcoming') {
        result = result.filter(m => new Date(m.kickoffTime).toISOString().slice(0, 10) > todayKey && m.status === 'scheduled');
      } else if (dateTab === 'calendar' && calendarDate) {
        result = result.filter(m => new Date(m.kickoffTime).toISOString().slice(0, 10) === calendarDate);
      }
    }
    if (leagueFilter !== 'all') {
      result = result.filter(m => m.league.slug === leagueFilter || m.league.name.toLowerCase().replace(/\s+/g, '-') === leagueFilter);
    }
    if (search) {
      const lo = search.toLowerCase();
      result = result.filter(m => m.homeTeam.name.toLowerCase().includes(lo) || m.awayTeam.name.toLowerCase().includes(lo) || m.league.name.toLowerCase().includes(lo));
    }
    return result;
  }, [matches, leagueFilter, search, dateTab, calendarDate, statusFilter]);

  return null;
}
