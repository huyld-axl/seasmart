import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Tàu và đối tác (ship owner): đọc, ghi, xoá mềm. Mọi thay đổi làm mới danh sách và lookup.
export function useFleetList(key, resourceApi, params) {
  return useQuery({ queryKey: ['fleet', key, 'list', params], queryFn: () => resourceApi.list(params), placeholderData: (previous) => previous })
}

export function useFleetItem(key, resourceApi, id) {
  return useQuery({ queryKey: ['fleet', key, 'item', id], queryFn: () => resourceApi.get(id), enabled: !!id })
}

export function useFleetMutations(resourceApi) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fleet'] })
    queryClient.invalidateQueries({ queryKey: ['lookup'] })
  }
  const save = useMutation({
    mutationFn: ({ id, ...values }) => (id ? resourceApi.update(id, values) : resourceApi.create(values)),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: (id) => resourceApi.remove(id), onSuccess: refresh })
  const restore = useMutation({ mutationFn: (id) => resourceApi.restore(id), onSuccess: refresh })
  return { save, remove, restore }
}
