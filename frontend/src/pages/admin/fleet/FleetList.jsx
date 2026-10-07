import { useState } from 'react'
import { Button, Dropdown, Form, Input, Table } from 'antd'
import { EditOutlined, DeleteOutlined, MoreOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import SlidePanel from '../../../components/ds/SlidePanel'
import useToast from '../../../components/ds/useToast'
import { EmptyState } from '../../../components/ds/Controls'
import useFleet from '../../../hooks/useFleet'

const PAGE_SIZE = 20

// Danh sách CRUD có xoá mềm (khuôn D3): bảng trong card, sửa và thêm chung một form trong panel trượt,
// xoá ngay rồi cho Hoàn tác trong toast.
export default function FleetList({ queryKey, resourceApi, noun, columns, renderForm, toFormValues, describe, searchPlaceholder }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const toast = useToast()
  const { list, save, remove, restore } = useFleet(queryKey, resourceApi, { search: search || undefined, page, limit: PAGE_SIZE })
  const rows = list.data?.data || []
  const total = list.data?.total || 0

  function openPanel(row) {
    setEditing(row || {})
    form.setFieldsValue(row ? toFormValues(row) : {})
  }

  async function submit() {
    const values = await form.validateFields()
    try {
      await save.mutateAsync({ id: editing?.id, ...values })
      toast.success(editing?.id ? `Đã lưu ${describe(values)}` : `Đã thêm ${describe(values)}`)
      setEditing(null)
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không lưu được. Thử lại sau.')
    }
  }

  async function handleDelete(row) {
    try {
      await remove.mutateAsync(row.id)
      toast.success(`Đã xoá ${describe(row)}`, {
        actionLabel: 'Hoàn tác',
        onAction: () => restore.mutate(row.id, { onError: (error) => toast.error(error?.response?.data?.error || 'Không hoàn tác được') }),
      })
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Không xoá được')
    }
  }

  const actionColumn = {
    title: <span className="ds-sr-only">Thao tác</span>,
    key: 'actions',
    width: 56,
    align: 'right',
    render: (_, row) => (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: 'Xoá', danger: true },
          ],
          onClick: ({ key }) => (key === 'edit' ? openPanel(row) : handleDelete(row)),
        }}
      >
        <Button type="text" icon={<MoreOutlined />} aria-label={`Thao tác với ${describe(row)}`} />
      </Dropdown>
    ),
  }

  let body
  if (list.isError) {
    body = <EmptyState isError title={`Không tải được danh sách ${noun}`} description="Mất kết nối tới máy chủ." action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
  } else if (!list.isLoading && !rows.length) {
    body = search ? (
      <EmptyState title={`Không có ${noun} nào khớp "${search}"`} description="Thử tìm bằng tên khác hoặc số IMO." action={<Button onClick={() => setSearch('')}>Xoá tìm kiếm</Button>} />
    ) : (
      <EmptyState title={`Chưa có ${noun} nào`} description={`Thêm ${noun} để dùng khi đối chiếu sea service và tạo bộ giấy tờ.`} action={<Button icon={<PlusOutlined />} onClick={() => openPanel(null)}>Thêm {noun}</Button>} />
    )
  } else {
    body = (
      <>
        <Table rowKey="id" loading={list.isLoading} dataSource={rows} columns={[...columns, actionColumn]} pagination={false} scroll={{ x: 'max-content' }} onRow={(row) => ({ onDoubleClick: () => openPanel(row) })} />
        <div className="ds-table-foot">
          <span className="ds-num">{total} {noun}</span>
          {total > PAGE_SIZE ? (
            <span className="ds-page__actions">
              <Button size="small" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</Button>
              <Button size="small" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Trang sau</Button>
            </span>
          ) : null}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ds-toolbar">
        <Input
          className="ds-toolbar__search"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <span className="ds-toolbar__end">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPanel(null)}>
            Thêm {noun}
          </Button>
        </span>
      </div>
      <div className="ds-card">{body}</div>
      <SlidePanel
        open={!!editing}
        title={editing?.id ? `Sửa ${noun}` : `Thêm ${noun}`}
        description={editing?.id ? describe(editing) : null}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Huỷ</Button>
            <Button type="primary" loading={save.isPending} onClick={submit}>
              {editing?.id ? 'Lưu' : `Thêm ${noun}`}
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" requiredMark onFinish={submit}>
          {renderForm(form)}
        </Form>
      </SlidePanel>
    </>
  )
}
