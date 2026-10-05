import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Col, Divider, Form, InputNumber, Modal, Row, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { salaryApi } from '../../api'

const { Text } = Typography

const fmtUSD = (v) =>
  v != null
    ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(v)
      )
    : null

const fmtVND = (v) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(Number(v))) : null

export default function SalaryFormModal({
  open,
  // eslint-disable-next-line no-unused-vars
  deploymentId,
  commissionRate,
  deploymentSalary, // lương thỏa thuận từ deployment để tính working_days
  salaryRecord,
  seafarerName,
  month, // YYYY-MM — required for create
  onClose,
  onSaved,
}) {
  const [form] = Form.useForm()

  const totalDaysInMonth = month ? dayjs(month, 'YYYY-MM').daysInMonth() : null

  useEffect(() => {
    if (!open) return
    if (salaryRecord?.salary_id) {
      form.setFieldsValue({
        salary_gross: salaryRecord.salary_gross ? parseFloat(salaryRecord.salary_gross) : undefined,
        working_days: salaryRecord.working_days ?? undefined,
        commission_rate:
          salaryRecord.commission_rate != null
            ? parseFloat(salaryRecord.commission_rate)
            : undefined,
        air_ticket: salaryRecord.air_ticket ? parseFloat(salaryRecord.air_ticket) : undefined,
        air_ticket_name: salaryRecord.air_ticket_name || undefined,
        doc_fee: salaryRecord.doc_fee ? parseFloat(salaryRecord.doc_fee) : undefined,
        signoff_fee: salaryRecord.signoff_fee ? parseFloat(salaryRecord.signoff_fee) : undefined,
        foreign_labor_fee: salaryRecord.foreign_labor_fee
          ? parseFloat(salaryRecord.foreign_labor_fee)
          : undefined,
        export_cost: salaryRecord.export_cost ? parseFloat(salaryRecord.export_cost) : undefined,
        other_cost: salaryRecord.other_cost ? parseFloat(salaryRecord.other_cost) : undefined,
        other_cost_note: salaryRecord.other_cost_note || undefined,
        exchange_rate: salaryRecord.exchange_rate
          ? parseFloat(salaryRecord.exchange_rate)
          : undefined,
        notes: salaryRecord.salary_notes || undefined,
      })
    } else {
      form.resetFields()
      if (commissionRate != null) {
        form.setFieldValue('commission_rate', parseFloat(commissionRate))
      }
    }
  }, [open, salaryRecord, commissionRate, form])

  const updateMut = useMutation({
    mutationFn: (values) => salaryApi.update(salaryRecord.salary_id, values),
    onSuccess: () => {
      message.success('Đã cập nhật')
      onSaved()
    },
    onError: (e) => message.error(e.response?.data?.error || 'Lỗi cập nhật'),
  })

  function handleSubmit(values) {
    updateMut.mutate(values)
  }

  const gross = Form.useWatch('salary_gross', form)
  const workingDays = Form.useWatch('working_days', form)
  const commRate = Form.useWatch('commission_rate', form)
  const airTicket = Form.useWatch('air_ticket', form)
  const docFee = Form.useWatch('doc_fee', form)
  const signoffFee = Form.useWatch('signoff_fee', form)
  const foreignLaborFee = Form.useWatch('foreign_labor_fee', form)
  const exportCost = Form.useWatch('export_cost', form)
  const otherCost = Form.useWatch('other_cost', form)
  const exchangeRate = Form.useWatch('exchange_rate', form)

  const commission = gross != null && commRate != null ? (gross * commRate) / 100 : null
  const deductions = [airTicket, docFee, signoffFee, foreignLaborFee, exportCost, otherCost].reduce(
    (s, v) => s + (v || 0),
    0
  )
  const net = gross != null ? gross - deductions : null
  const netVnd = net != null && exchangeRate ? net * exchangeRate : null
  const profit =
    gross != null && commission != null && net != null ? gross - commission - net : null

  const monthLabel = month ? dayjs(month, 'YYYY-MM').format('MM/YYYY') : ''
  const loading = updateMut.isPending

  return (
    <Modal
      open={open}
      title={
        <span>
          Sửa lương tháng {monthLabel}
          {seafarerName && (
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
              — {seafarerName}
            </Text>
          )}
        </span>
      }
      onCancel={onClose}
      footer={null}
      width="min(620px, calc(100vw - 32px))"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 8 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Form.Item
              label={totalDaysInMonth ? `Số ngày làm (/${totalDaysInMonth})` : 'Số ngày làm'}
              name="working_days"
            >
              <InputNumber
                min={1}
                max={totalDaysInMonth || 31}
                precision={0}
                style={{ width: '100%' }}
                onChange={(v) => {
                  if (v != null && deploymentSalary != null && totalDaysInMonth != null) {
                    const calc = parseFloat(
                      ((parseFloat(deploymentSalary) * v) / totalDaysInMonth).toFixed(2)
                    )
                    form.setFieldValue('salary_gross', calc)
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item
              label={
                workingDays != null && deploymentSalary != null && totalDaysInMonth != null ? (
                  <span>
                    Lương HĐ (USD){' '}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      = {deploymentSalary} × {workingDays}/{totalDaysInMonth}
                    </Text>
                  </span>
                ) : (
                  'Lương HĐ (USD)'
                )
              }
              name="salary_gross"
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="1200" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Hoa hồng (%)" name="commission_rate">
          <InputNumber
            min={0}
            max={100}
            precision={2}
            style={{ width: '100%' }}
            placeholder="8.5"
          />
        </Form.Item>

        {commission != null && (
          <div style={{ marginBottom: 10, color: '#888', fontSize: 13 }}>
            Tiền hoa hồng: <Text strong>{fmtUSD(commission)} USD</Text>
          </div>
        )}

        <Divider orientation="left" plain style={{ fontSize: 13, margin: '8px 0' }}>
          Khoản TV phải chịu
        </Divider>

        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item label="Vé máy bay (USD)" name="air_ticket">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item label="Tên trên vé" name="air_ticket_name">
              <input
                className="ant-input"
                placeholder="NGUYEN VAN A"
                style={{
                  width: '100%',
                  padding: '4px 11px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 2,
                }}
                onChange={(e) => form.setFieldValue('air_ticket_name', e.target.value)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item label="Tiền làm CC" name="doc_fee">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Phí sign-off" name="signoff_fee">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item label="Phí LD nước ngoài" name="foreign_labor_fee">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Chi phí xuất khẩu" name="export_cost">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item label="Chi phí ngoài" name="other_cost">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item label="Ghi chú chi phí ngoài" name="other_cost_note">
              <input
                className="ant-input"
                style={{
                  width: '100%',
                  padding: '4px 11px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 2,
                }}
                onChange={(e) => form.setFieldValue('other_cost_note', e.target.value)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider plain style={{ margin: '8px 0' }} />

        <Row gutter={12} align="middle">
          <Col xs={24} sm={10}>
            <Form.Item label="Tỷ giá (1 USD = ? VND)" name="exchange_rate">
              <InputNumber
                min={0}
                precision={0}
                style={{ width: '100%' }}
                placeholder="25500"
                formatter={(v) => (v ? new Intl.NumberFormat('vi-VN').format(v) : '')}
                parser={(v) => v.replace(/[^0-9]/g, '')}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <div
              style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 4,
                padding: '8px 12px',
                marginTop: 4,
              }}
            >
              <Row justify="space-between">
                <Text style={{ fontSize: 13 }}>Tổng khấu trừ TV:</Text>
                <Text strong>{deductions > 0 ? `${fmtUSD(deductions)} USD` : '-'}</Text>
              </Row>
              <Row justify="space-between" style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 14 }}>Thực nhận:</Text>
                <Text strong style={{ fontSize: 15, color: '#007a33' }}>
                  {net != null ? `${fmtUSD(net)} USD` : '-'}
                </Text>
              </Row>
              {netVnd != null && (
                <Row justify="end">
                  <Text style={{ color: '#555', fontSize: 12 }}>≈ {fmtVND(netVnd)} VND</Text>
                </Row>
              )}
              {profit != null && (
                <Row
                  justify="space-between"
                  style={{ marginTop: 4, borderTop: '1px solid #d9f7be', paddingTop: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#888' }}>Lãi tháng này:</Text>
                  <Text strong style={{ color: profit >= 0 ? '#07bc0c' : '#e74c3c', fontSize: 13 }}>
                    {fmtUSD(profit)} USD
                  </Text>
                </Row>
              )}
            </div>
          </Col>
        </Row>

        <Form.Item label="Ghi chú" name="notes" style={{ marginBottom: 8 }}>
          <input
            className="ant-input"
            style={{
              width: '100%',
              padding: '4px 11px',
              border: '1px solid #d9d9d9',
              borderRadius: 2,
            }}
            onChange={(e) => form.setFieldValue('notes', e.target.value)}
          />
        </Form.Item>

        <Row justify="end" gutter={8}>
          <Col>
            <Button onClick={onClose}>Hủy</Button>
          </Col>
          <Col>
            <Button type="primary" htmlType="submit" loading={loading}>
              Cập nhật
            </Button>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
