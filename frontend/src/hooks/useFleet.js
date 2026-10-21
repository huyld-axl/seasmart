import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shipOwnerLogoApi } from '../api/fleetApi'

// Tàu và đối tác (ship owner): đọc, ghi, xoá mềm. Mọi thay đổi làm mới danh sách và lookup.
export function useFleetList(key, resourceApi, params, options = {}) {
  return useQuery({
    queryKey: ['fleet', key, 'list', params],
    queryFn: () => resourceApi.list(params),
    placeholderData: (previous) => previous,
    ...options,
  })
}

export function useFleetItem(key, resourceApi, id) {
  return useQuery({
    queryKey: ['fleet', key, 'item', id],
    queryFn: () => resourceApi.get(id),
    enabled: !!id,
  })
}

export function useFleetMutations(resourceApi) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fleet'] })
    queryClient.invalidateQueries({ queryKey: ['lookup'] })
  }
  const save = useMutation({
    mutationFn: ({ id, ...values }) =>
      id ? resourceApi.update(id, values) : resourceApi.create(values),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: (id) => resourceApi.remove(id), onSuccess: refresh })
  const restore = useMutation({ mutationFn: (id) => resourceApi.restore(id), onSuccess: refresh })
  return { save, remove, restore }
}

export function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Logo đối tác dạng data URL (ảnh cần token nên không gắn thẳng vào <img src>). Trả undefined khi chưa có logo.
export function usePartnerLogo(owner) {
  const { data } = useQuery({
    queryKey: ['fleet', 'logo', owner?.id, owner?.updated_at],
    queryFn: () => shipOwnerLogoApi.get(owner.id).then(readAsDataUrl),
    enabled: !!owner?.id && !!owner?.has_logo,
    staleTime: Infinity,
  })
  return owner?.has_logo ? data : undefined
}
