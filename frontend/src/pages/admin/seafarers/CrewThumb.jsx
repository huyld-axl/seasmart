import { useQuery } from '@tanstack/react-query'
import { seafarerApi } from '../../../api'
import CrewPhoto from './CrewPhoto'

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

// Ảnh nhỏ (thumbnail 108x144) của thuyền viên cho danh sách. Tải ảnh nhỏ thay vì ảnh gốc, nhớ theo ngày đổi ảnh nên không tải lại khi cuộn hay đổi trang.
export default function CrewThumb({ id, hasPhoto, version }) {
  const { data } = useQuery({
    queryKey: ['seafarer-thumb', id, version],
    queryFn: () => seafarerApi.getPhoto(id, 'thumb').then(toDataUrl),
    enabled: Boolean(hasPhoto),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  })
  return <CrewPhoto src={data} />
}
