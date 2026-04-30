"use client"

import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Search, Newspaper, ExternalLink, Loader2, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface NewsArticle {
  id: string
  headline: string
  description: string
  image: string | null
  published: string
  source: string
  source_url: string
  category?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AdminNewsPage() {
  const { data, isLoading } = useSWR<{ articles: NewsArticle[] }>('/api/admin/news', fetcher, { refreshInterval: 60000 })
  const [searchQuery, setSearchQuery] = useState("")

  const articles = data?.articles || []
  const filtered = articles.filter(a =>
    !searchQuery || a.headline.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold">News Feed</h1>
        <p className="text-xs text-muted-foreground">Live editorial articles surfaced from ESPN sports news</p>
      </div>

      <div className="grid gap-2 grid-cols-3">
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Articles</div><div className="text-base font-bold tabular-nums">{articles.length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Today</div><div className="text-base font-bold tabular-nums">{articles.filter(a => Date.now() - new Date(a.published).getTime() < 86_400_000).length}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Sources</div><div className="text-base font-bold tabular-nums">{new Set(articles.map(a => a.source)).size}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search articles…" className="h-8 pl-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-xs text-muted-foreground">
          <Newspaper className="mx-auto h-8 w-8 mb-2 opacity-30" />
          No articles available right now.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <Card key={a.id} className="overflow-hidden">
              {a.image && (
                <div className="relative h-32 w-full bg-muted">
                  <Image src={a.image} alt={a.headline} fill className="object-cover" unoptimized />
                </div>
              )}
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{a.source}</Badge>
                  <Calendar className="h-3 w-3" />
                  {new Date(a.published).toLocaleDateString()}
                </div>
                <h3 className="text-xs font-semibold line-clamp-2">{a.headline}</h3>
                <p className="text-[11px] text-muted-foreground line-clamp-3">{a.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <Link
                    href={`/news/article?headline=${encodeURIComponent(a.headline)}&description=${encodeURIComponent(a.description)}&image=${encodeURIComponent(a.image || '')}&published=${encodeURIComponent(a.published)}&source_url=${encodeURIComponent(a.source_url)}&source=${encodeURIComponent(a.source)}`}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    View on site →
                  </Link>
                  {a.source_url && (
                    <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
