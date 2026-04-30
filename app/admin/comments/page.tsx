"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Search, Trash2, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"

interface Comment {
  id: string
  postId: string
  userId: number
  authorName: string
  authorAvatar?: string | null
  content: string
  createdAt: string
  postTitle?: string | null
  postAuthor?: string | null
}

interface ApiResponse {
  comments: Comment[]
  stats: { total: number; today: number; week: number }
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AdminCommentsPage() {
  const { data, isLoading, mutate } = useSWR<ApiResponse>('/api/admin/comments', fetcher, { refreshInterval: 30000 })
  const [searchQuery, setSearchQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const comments = data?.comments || []
  const stats = data?.stats || { total: 0, today: 0, week: 0 }

  const filtered = comments.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.content.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q)
  })

  async function remove(id: string) {
    if (!confirm("Delete this comment?")) return
    setBusyId(id)
    try {
      await fetch(`/api/admin/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      await mutate()
    } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold">Comments Moderation</h1>
        <p className="text-xs text-muted-foreground">Real comments from the community feed</p>
      </div>

      <div className="grid gap-2 grid-cols-3">
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Total</div><div className="text-base font-bold tabular-nums">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">Today</div><div className="text-base font-bold tabular-nums">{stats.today}</div></CardContent></Card>
        <Card><CardContent className="p-2.5"><div className="text-[10px] uppercase text-muted-foreground">7 days</div><div className="text-base font-bold tabular-nums">{stats.week}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search comments…" className="h-8 pl-8 text-xs" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <Card><CardContent className="p-8 text-center text-xs text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
              No comments yet — they appear here when users comment on community posts.
            </CardContent></Card>
          )}
          {filtered.map(c => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-semibold">{c.authorName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{format(new Date(c.createdAt), 'MMM d HH:mm')}</span>
                      {c.postTitle && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <Link href={`/feed#${c.postId}`} className="text-primary hover:underline truncate max-w-[200px]">
                            {c.postTitle}
                          </Link>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-xs whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => remove(c.id)}
                    disabled={busyId === c.id}
                    className="h-7 w-7 text-destructive"
                  >
                    {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
