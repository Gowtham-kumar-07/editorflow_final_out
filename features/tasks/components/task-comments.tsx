'use client'

import { useRef, useState } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { formatDate } from '@/utils/format'
import { useTaskComments, useAddTaskComment } from '../hooks/use-tasks'

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

type Props = {
  taskId:      string
  currentUser: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export function TaskComments({ taskId, currentUser }: Props) {
  const { data: result, isPending } = useTaskComments(taskId)
  const addComment = useAddTaskComment(taskId)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    const res = await addComment.mutateAsync(trimmed)
    if (!res.ok) {
      toast.error(res.error)
    } else {
      setText('')
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const comments = result?.ok ? result.data : []
  const isEmpty = !isPending && comments.length === 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">
          Comments {!isPending && comments.length > 0 && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing comments */}
        {isPending ? (
          <CommentsSkeleton />
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first.</p>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                  {comment.user?.avatar_url && <AvatarImage src={comment.user.avatar_url} />}
                  <AvatarFallback className="text-xs">
                    {initials(comment.user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {comment.user?.full_name ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.created_at)}
                      {comment.edited_at && ' (edited)'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{comment.comment}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Comment form */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Avatar className="mt-0.5 h-8 w-8 shrink-0">
            {currentUser?.avatar_url && <AvatarImage src={currentUser.avatar_url} />}
            <AvatarFallback className="text-xs">
              {initials(currentUser?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              ref={textareaRef}
              placeholder="Add a comment… (Ctrl+Enter to submit)"
              className="min-h-[80px] resize-none text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={addComment.isPending}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!text.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {addComment.isPending ? 'Posting…' : 'Comment'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
