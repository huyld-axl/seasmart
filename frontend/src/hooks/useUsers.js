import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { message } from 'antd'
import { usersApi } from '../api/usersApi'

export function useUsers(filters = {}) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => usersApi.list(filters).then((r) => r.data),
  })
}

export function useUser(id) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getById(id).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => usersApi.create(data).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Tạo user thành công')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
      message.error(msg)
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Cập nhật user thành công')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
      message.error(msg)
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      message.success('Đã xóa user')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
      message.error(msg)
    },
  })
}

export function useToggleActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => usersApi.toggleActive(id).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'
      message.error(msg)
    },
  })
}
