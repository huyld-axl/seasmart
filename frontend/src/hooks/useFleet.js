import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// CRUD có xoá mềm cho Tàu và Chủ tàu. Mọi thay đổi làm mới danh sách và lookup.
export default function useFleet(key, resourceApi, params) {
  const queryClient = useQueryClient()
  const listKey = ['fleet', key, params]
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fleet'] })
    queryClient.invalidateQueries({ queryKey: ['lookup'] })
  }
  const list = useQuery({ queryKey: listKey, queryFn: () => resourceApi.list(params), placeholderData: (previous) => previous })
  const save = useMutation({
    mutationFn: ({ id, ...values }) => (id ? resourceApi.update(id, values) : resourceApi.create(values)),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: (id) => resourceApi.remove(id), onSuccess: refresh })
  const restore = useMutation({ mutationFn: (id) => resourceApi.restore(id), onSuccess: refresh })
  return { list, save, remove, restore }
}
