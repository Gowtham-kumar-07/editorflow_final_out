'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

import { createTaskAction, updateTaskAction } from '../actions'
import { taskFormSchema, taskToFormValues, TASK_FORM_DEFAULTS, type TaskFormValues } from '../schema'
import type { TaskWithDetails, OrgMember, ProjectOption } from '../types'

// ─── Props ────────────────────────────────────────────────────────────────────

type TaskFormProps =
  | { mode: 'create'; projects: ProjectOption[]; members: OrgMember[]; defaultProjectId?: string; canEditAmount?: boolean }
  | { mode: 'edit';   task: TaskWithDetails;    projects: ProjectOption[]; members: OrgMember[]; canEditAmount?: boolean }

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskForm(props: TaskFormProps) {
  const router = useRouter()
  const [serverError, setServerError]   = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canEditAmount = props.canEditAmount ?? false

  const defaultValues: TaskFormValues =
    props.mode === 'edit'
      ? taskToFormValues(props.task)
      : { ...TASK_FORM_DEFAULTS, project_id: props.defaultProjectId ?? '' }

  const form = useForm<TaskFormValues>({
    resolver:      zodResolver(taskFormSchema),
    defaultValues,
  })

  const { isDirty } = form.formState

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  async function onSubmit(values: TaskFormValues) {
    setServerError(null)
    setIsSubmitting(true)
    try {
      if (props.mode === 'create') {
        const result = await createTaskAction(values)
        if (!result.ok) { setServerError(result.error); return }
        toast.success(`"${result.data.title}" created.`)
        router.push(`/tasks/${result.data.id}`)
      } else {
        const result = await updateTaskAction(props.task.id, values)
        if (!result.ok) { setServerError(result.error); return }
        toast.success('Task updated.')
        router.push(`/tasks/${props.task.id}`)
        router.refresh()
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const cancelHref = props.mode === 'edit' ? `/tasks/${props.task.id}` : '/tasks'

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* ── Core ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Task Details
          </h2>

          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input placeholder="Design homepage wireframe" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What needs to be done?"
                  className="min-h-[100px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </section>

        <Separator />

        {/* ── Assignment ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Assignment
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="project_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Project *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {props.projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="assigned_to" render={({ field }) => (
              <FormItem>
                <FormLabel>Assignee</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {props.members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <Separator />

        {/* ── Status & Priority ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Status &amp; Priority
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">In Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="priority" render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        <Separator />

        {/* ── Schedule ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Schedule
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="due_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="estimated_hours" render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Hours</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.5" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Task Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    disabled={!canEditAmount}
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </section>

        {/* ── Actions ────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting
              ? props.mode === 'create' ? 'Creating…' : 'Saving…'
              : props.mode === 'create' ? 'Create Task' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
