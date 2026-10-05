import { useCallback } from 'react'
import { translate } from '../locales'

export default function useTranslation() {
  const t = useCallback((key, vars) => translate(key, vars), [])
  return { t, locale: 'vi' }
}
