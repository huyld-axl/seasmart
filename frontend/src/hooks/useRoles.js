import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { roleApi } from '../api/roleApi'

export function useRoles(options = {}) {
  return useQuery({ queryKey: ['roles'], queryFn: roleApi.list, ...options })
}

// Danh mục quyền gần như không đổi trong một phiên.
export function useRoleCatalog() {
  return useQuery({ queryKey: ['roles', 'catalog'], queryFn: roleApi.catalog, staleTime: Infinity })
}

function useRoleMutation(fn) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useCreateRole = () => useRoleMutation(roleApi.create)
export const useUpdateRole = () => useRoleMutation(({ id, data }) => roleApi.update(id, data))
export const useSaveRolePermissions = () => useRoleMutation(roleApi.savePermissions)
export const useDeleteRole = () => useRoleMutation(roleApi.remove)
