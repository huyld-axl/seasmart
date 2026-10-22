import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { voyageApi, seafarerContractApi, billApi } from '../api/voyageApi'

export function useVoyageList(params, options = {}) {
  return useQuery({
    queryKey: ['voyages', 'list', params],
    queryFn: () => voyageApi.list(params),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useVoyage(id) {
  return useQuery({
    queryKey: ['voyages', 'item', id],
    queryFn: () => voyageApi.get(id),
    enabled: !!id,
  })
}

export function useContractList(params, options = {}) {
  return useQuery({
    queryKey: ['contracts', 'list', params],
    queryFn: () => seafarerContractApi.list(params),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useContract(id) {
  return useQuery({
    queryKey: ['contracts', 'item', id],
    queryFn: () => seafarerContractApi.get(id),
    enabled: !!id,
  })
}

// Mọi thay đổi làm mới chuyến, hợp đồng và thuyền viên (trạng thái thuyền viên đổi theo chuyến).
function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['voyages', 'contracts', 'seafarers', 'bills'])
      queryClient.invalidateQueries({ queryKey: [key] })
  }
}

export function useVoyageMutations() {
  const refresh = useRefresh()
  const options = { onSuccess: refresh }
  return {
    save: useMutation({
      mutationFn: ({ id, ...values }) =>
        id ? voyageApi.update(id, values) : voyageApi.create(values),
      ...options,
    }),
    remove: useMutation({ mutationFn: (id) => voyageApi.remove(id), ...options }),
    start: useMutation({ mutationFn: ({ id, ...body }) => voyageApi.start(id, body), ...options }),
    end: useMutation({ mutationFn: ({ id, ...body }) => voyageApi.end(id, body), ...options }),
  }
}

export function useContractMutations() {
  const refresh = useRefresh()
  const options = { onSuccess: refresh }
  return {
    save: useMutation({
      mutationFn: ({ id, ...values }) =>
        id ? seafarerContractApi.update(id, values) : seafarerContractApi.create(values),
      ...options,
    }),
    remove: useMutation({ mutationFn: (id) => seafarerContractApi.remove(id), ...options }),
    submit: useMutation({ mutationFn: (id) => seafarerContractApi.submit(id), ...options }),
    withdraw: useMutation({ mutationFn: (id) => seafarerContractApi.withdraw(id), ...options }),
    approve: useMutation({
      mutationFn: ({ id, ...body }) => seafarerContractApi.approve(id, body),
      ...options,
    }),
    reject: useMutation({
      mutationFn: ({ id, ...body }) => seafarerContractApi.reject(id, body),
      ...options,
    }),
  }
}

export function useBillList(params, options = {}) {
  return useQuery({
    queryKey: ['bills', 'list', params],
    queryFn: () => billApi.list(params),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useBill(id) {
  return useQuery({
    queryKey: ['bills', 'item', id],
    queryFn: () => billApi.get(id),
    enabled: !!id,
  })
}

export function useBillMutations() {
  const queryClient = useQueryClient()
  const options = { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills'] }) }
  return {
    save: useMutation({ mutationFn: ({ id, ...body }) => billApi.update(id, body), ...options }),
    move: useMutation({ mutationFn: ({ id, action, ...body }) => billApi.move(id, action, body), ...options }),
  }
}
