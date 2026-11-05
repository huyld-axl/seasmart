import { Skeleton, Table } from 'antd'
import useViewport from '../../hooks/useViewport'
import './ds.css'

const ROLES = ['title', 'sub', 'meta', 'value', 'actions']

const keyOf = (rowKey, row, index) => (typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey] ?? index)
const valueOf = (column, row) => (Array.isArray(column.dataIndex) ? column.dataIndex.reduce((object, key) => object?.[key], row) : row[column.dataIndex])
const cellOf = (column, row, index) => (column.render ? column.render(valueOf(column, row), row, index) : valueOf(column, row))
const stop = (event) => event.stopPropagation()

// Bảng ít cột (kế hoạch responsive mục 4.3). Desktop: Table của antd, mọi prop truyền thẳng. Điện thoại (< 640px): mỗi
// dòng hai tầng thay vì bảng cuộn ngang. Mỗi cột khai báo `mobile`: 'title' (tên, đậm), 'sub' (dòng phụ), 'meta' (badge,
// chữ nhỏ), 'value' (số / nhãn chính bên phải), 'actions' (nút cuối dòng, bấm không mở dòng). Cột không có `mobile` thì ẩn.
export default function RowList({ columns, dataSource = [], rowKey = 'id', onRow, loading, locale, ...tableProps }) {
  const { isPhone } = useViewport()
  if (!isPhone) return <Table columns={columns} dataSource={dataSource} rowKey={rowKey} onRow={onRow} loading={loading} locale={locale} {...tableProps} />

  if (loading) return <div className="ds-rowlist ds-rowlist--loading"><Skeleton active title={false} paragraph={{ rows: 4 }} /></div>
  if (!dataSource.length) return <div className="ds-rowlist ds-rowlist--empty">{locale?.emptyText ?? 'Không có dữ liệu'}</div>

  const byRole = Object.fromEntries(ROLES.map((role) => [role, columns.filter((column) => column.mobile === role)]))
  return (
    <ul className="ds-rowlist">
      {dataSource.map((row, index) => {
        const handlers = onRow?.(row, index) || {}
        const open = handlers.onClick
        const cells = (role) => byRole[role].map((column) => <span key={column.key || column.dataIndex}>{cellOf(column, row, index)}</span>)
        return (
          <li
            key={keyOf(rowKey, row, index)}
            className={open ? 'ds-rowlist__row ds-rowlist__row--link' : 'ds-rowlist__row'}
            role={open ? 'button' : undefined}
            tabIndex={open ? 0 : undefined}
            onClick={open}
            onKeyDown={open ? (event) => event.key === 'Enter' && event.target === event.currentTarget && open(event) : undefined}
          >
            <span className="ds-rowlist__main">
              {byRole.title.length ? <span className="ds-rowlist__title">{cells('title')}</span> : null}
              {byRole.sub.length ? <span className="ds-rowlist__sub">{cells('sub')}</span> : null}
              {byRole.meta.length ? <span className="ds-rowlist__meta">{cells('meta')}</span> : null}
            </span>
            {byRole.value.length ? <span className="ds-rowlist__values">{cells('value')}</span> : null}
            {byRole.actions.length ? (
              <span className="ds-rowlist__actions" onClick={stop} onKeyDown={stop}>
                {cells('actions')}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
