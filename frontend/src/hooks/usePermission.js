import useAuthStore from '../stores/authStore'

// Có đủ mọi quyền được hỏi không. Chưa đăng nhập thì luôn false.
export function canOf(user, ...perms) {
  if (!user) return false
  const have = user.permissions || []
  return perms.every((perm) => have.includes(perm))
}

// `can('seafarer.update')` → true/false; nhiều quyền thì phải đủ hết.
export function useCan() {
  const user = useAuthStore((state) => state.user)
  return (...perms) => canOf(user, ...perms)
}

// Phạm vi dữ liệu của một mục: 'all' | 'own'.
export function scopeOf(user, module) {
  return user?.scopes?.[module] === 'own' ? 'own' : 'all'
}
