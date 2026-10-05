import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Input, DatePicker, Space, Tooltip, Modal, message } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { seamanBookApi } from '../../api'
import dayjs from 'dayjs'

const fmt = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '-')

export default function SeamanBooksSection({ seafarerId, isReadOnly }) {
  const queryClient = useQueryClient()
  const [inlineRow, setInlineRow] = useState(null) // { book_number, issued_date, expiry_date, issued_place }
  const [editId, setEditId] = useState(null)
  const [editRow, setEditRow] = useState(null)

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['seaman-books', seafarerId],
    queryFn: () => seamanBookApi.list(seafarerId).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => seamanBookApi.create(seafarerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seaman-books', seafarerId] })
      setInlineRow(null)
    },
    onError: (e) => message.error(e.response?.data?.error || 'Thêm thất bại'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => seamanBookApi.update(seafarerId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seaman-books', seafarerId] })
      setEditId(null)
      setEditRow(null)
    },
    onError: (e) => message.error(e.response?.data?.error || 'Cập nhật thất bại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => seamanBookApi.remove(seafarerId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seaman-books', seafarerId] }),
    onError: () => message.error('Xóa thất bại'),
  })

  function startEdit(row) {
    setEditId(row.id)
    setEditRow({
      book_number: row.book_number || '',
      issued_date: row.issued_date || null,
      expiry_date: row.expiry_date || null,
      issued_place: row.issued_place || '',
    })
  }

  const columns = [
    {
      title: 'Số sổ',
      dataIndex: 'book_number',
      render: (v, r) => {
        if (r._inline)
          return (
            <Input
              size="small"
              value={inlineRow?.book_number}
              placeholder="Số sổ..."
              onChange={(e) => setInlineRow((p) => ({ ...p, book_number: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          )
        if (editId === r.id)
          return (
            <Input
              size="small"
              value={editRow?.book_number}
              onChange={(e) => setEditRow((p) => ({ ...p, book_number: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          )
        return <strong>{v}</strong>
      },
    },
    {
      title: 'Ngày cấp',
      dataIndex: 'issued_date',
      render: (v, r) => {
        if (r._inline)
          return (
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              value={inlineRow?.issued_date ? dayjs(inlineRow.issued_date) : null}
              onChange={(d) =>
                setInlineRow((p) => ({ ...p, issued_date: d ? d.format('YYYY-MM-DD') : null }))
              }
              onClick={(e) => e.stopPropagation()}
              style={{ width: 120 }}
            />
          )
        if (editId === r.id)
          return (
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              value={editRow?.issued_date ? dayjs(editRow.issued_date) : null}
              onChange={(d) =>
                setEditRow((p) => ({ ...p, issued_date: d ? d.format('YYYY-MM-DD') : null }))
              }
              onClick={(e) => e.stopPropagation()}
              style={{ width: 120 }}
            />
          )
        return fmt(v)
      },
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expiry_date',
      render: (v, r) => {
        if (r._inline)
          return (
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              value={inlineRow?.expiry_date ? dayjs(inlineRow.expiry_date) : null}
              onChange={(d) =>
                setInlineRow((p) => ({ ...p, expiry_date: d ? d.format('YYYY-MM-DD') : null }))
              }
              onClick={(e) => e.stopPropagation()}
              style={{ width: 120 }}
            />
          )
        if (editId === r.id)
          return (
            <DatePicker
              size="small"
              format="DD/MM/YYYY"
              value={editRow?.expiry_date ? dayjs(editRow.expiry_date) : null}
              onChange={(d) =>
                setEditRow((p) => ({ ...p, expiry_date: d ? d.format('YYYY-MM-DD') : null }))
              }
              onClick={(e) => e.stopPropagation()}
              style={{ width: 120 }}
            />
          )
        return fmt(v)
      },
    },
    {
      title: 'Nơi cấp',
      dataIndex: 'issued_place',
      render: (v, r) => {
        if (r._inline)
          return (
            <Input
              size="small"
              value={inlineRow?.issued_place}
              placeholder="Nơi cấp..."
              onChange={(e) => setInlineRow((p) => ({ ...p, issued_place: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          )
        if (editId === r.id)
          return (
            <Input
              size="small"
              value={editRow?.issued_place}
              onChange={(e) => setEditRow((p) => ({ ...p, issued_place: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
          )
        return v || '-'
      },
    },
    {
      title: '',
      width: 80,
      render: (_, r) => {
        if (r._inline)
          return (
            <Space size={4}>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={createMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  createMutation.mutate(inlineRow)
                }}
              />
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setInlineRow(null)
                }}
              />
            </Space>
          )
        if (editId === r.id)
          return (
            <Space size={4}>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                loading={updateMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  updateMutation.mutate({ id: r.id, data: editRow })
                }}
              />
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setEditId(null)
                  setEditRow(null)
                }}
              />
            </Space>
          )
        if (isReadOnly) return null
        return (
          <Space size={2}>
            <Tooltip title="Sửa">
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => startEdit(r)}
              />
            </Tooltip>
            <Tooltip title="Xóa">
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  Modal.confirm({
                    title: 'Xóa sổ thuyền viên?',
                    content: `Xóa sổ số "${r.book_number}"?`,
                    okText: 'Xóa',
                    okType: 'danger',
                    cancelText: 'Hủy',
                    onOk: () => deleteMutation.mutateAsync(r.id),
                  })
                }
              />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  const dataSource = [...(inlineRow ? [{ id: '_inline', _inline: true }] : []), ...books]

  return (
    <div>
      {!isReadOnly && !inlineRow && (
        <div style={{ marginBottom: 8 }}>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              setInlineRow({
                book_number: '',
                issued_date: null,
                expiry_date: null,
                issued_place: '',
              })
            }
          >
            Thêm sổ
          </Button>
        </div>
      )}
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        locale={{ emptyText: 'Chưa có thông tin sổ thuyền viên' }}
      />
    </div>
  )
}
