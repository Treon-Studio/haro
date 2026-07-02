'use client'

import { useState, useId, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@treonstudio/bungas-core/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@treonstudio/bungas-core/ui/label'

function useCreateProjectMutation() {
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)

  const mutateAsync = async ({ name }: { name: string }) => {
    setIsLoading(true)
    setIsError(false)
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Gagal membuat proyek')
      }
      
      return result.data
    } catch (err) {
      setIsError(true)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { isLoading, isError, mutateAsync }
}

interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (name: string) => void;
  children?: React.ReactNode;
}

export function ProjectCreateDialog({ open, onOpenChange, onCreated, children }: ProjectCreateDialogProps) {
  const [name, setName] = useState('')
  const createProject = useCreateProjectMutation()
  const inputRef = useRef<HTMLInputElement>(null)
  const formId = useId()

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen && !createProject.isLoading) {
      setName('')
    }
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim();
    if (!trimmedName || createProject.isLoading) {
      return;
    }
    
    try {
      await createProject.mutateAsync({ name: trimmedName })
      setName('')
      onOpenChange(false)
      onCreated?.(trimmedName)
    } catch {
      // Simulate toast error
      console.error('Error creating project')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-11/12 max-w-lg bg-surface-primary text-text-primary">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <form id={formId} onSubmit={handleCreate} className="space-y-2">
          <Label htmlFor={`${formId}-name`} className="text-sm font-medium text-text-primary">
            Project Name
          </Label>
          <Input
            id={`${formId}-name`}
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Marketing Campaign"
            className="w-full bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring-primary"
          />
          {createProject.isError && (
            <p className="text-sm text-red-500 mt-1">
              Failed to create project. Please try again.
            </p>
          )}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            disabled={!name.trim() || createProject.isLoading}
          >
            {createProject.isLoading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
