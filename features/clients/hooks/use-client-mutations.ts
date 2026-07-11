'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clientKeys } from '../queries/client-queries'
import { createClientAction } from '../actions'
import type { ClientFormValues } from '../schema'
import type { Client } from '@/types/client'

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ClientFormValues): Promise<Client> => {
      const result = await createClientAction(values)
      if (!result.ok) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    },
  })
}
