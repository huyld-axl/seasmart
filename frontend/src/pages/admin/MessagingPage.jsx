import { useState } from 'react'
import {
  List,
  Input,
  Button,
  Avatar,
  Badge,
  Typography,
  Empty,
  Spin,
  Form,
  Modal,
  Select,
} from 'antd'
import { SendOutlined, UserOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import api from '../../api/client'
import { usersApi } from '../../api/usersApi'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const { Text } = Typography

export default function MessagingPage() {
  const qc = useQueryClient()
  const [activeThread, setActiveThread] = useState(null)
  const [text, setText] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [userSearchOptions, setUserSearchOptions] = useState([])
  const [userSearching, setUserSearching] = useState(false)
  const [form] = Form.useForm()

  async function onSearchUser(q) {
    if (!q || q.length < 2) {
      setUserSearchOptions([])
      return
    }
    setUserSearching(true)
    try {
      const list = await usersApi.search(q)
      setUserSearchOptions(
        list.map((u) => ({ id: u.id, display_name: u.display_name, email: u.email, role: u.role }))
      )
    } catch {
      setUserSearchOptions([])
    } finally {
      setUserSearching(false)
    }
  }

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: () => api.get('/messages/threads').then((r) => r.data),
    refetchInterval: 15000,
  })

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', 'thread', activeThread],
    queryFn: () => api.get(`/messages/threads/${activeThread}`).then((r) => r.data),
    enabled: !!activeThread,
    refetchInterval: 8000,
  })

  const sendMsg = useMutation({
    mutationFn: (body) => api.post('/messages', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', 'thread', activeThread] })
      qc.invalidateQueries({ queryKey: ['messages', 'threads'] })
      setText('')
    },
  })

  const startThread = useMutation({
    mutationFn: (body) => api.post('/messages', body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['messages', 'threads'] })
      setActiveThread(res.data.conversation_id)
      setNewOpen(false)
      form.resetFields()
    },
  })

  function handleSend() {
    if (!text.trim() || !activeThread) return
    sendMsg.mutate({ conversation_id: activeThread, content: text.trim() })
  }

  async function handleNewThread() {
    const values = await form.validateFields()
    startThread.mutate({ recipient_id: Number(values.recipient_id), content: values.content })
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 120px)',
        gap: 0,
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #f0f0f0',
      }}
    >
      {/* Thread list */}
      <div
        style={{
          width: 300,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 600 }}>Tin nhắn</span>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>
            Mới
          </Button>
        </div>
        {loadingThreads ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : threads.length === 0 ? (
          <Empty description="Chưa có tin nhắn" style={{ marginTop: 40 }} />
        ) : (
          <List
            style={{ flex: 1, overflowY: 'auto' }}
            dataSource={threads}
            renderItem={(t) => (
              <List.Item
                onClick={() => setActiveThread(t.id)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: activeThread === t.id ? '#e6f4ff' : 'transparent',
                  borderLeft: activeThread === t.id ? '3px solid #1677ff' : '3px solid transparent',
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={t.unread_count} size="small">
                      <Avatar icon={<UserOutlined />} />
                    </Badge>
                  }
                  title={
                    <Text strong={t.unread_count > 0}>{t.title || `Cuộc trò chuyện #${t.id}`}</Text>
                  }
                  description={
                    <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                      {t.last_message || '-'}
                    </Text>
                  }
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t.last_message_at ? dayjs(t.last_message_at).fromNow() : ''}
                </Text>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Message area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!activeThread ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="Chọn một cuộc trò chuyện" />
          </div>
        ) : (
          <>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {loadingMsgs ? (
                <Spin style={{ margin: 'auto' }} />
              ) : (
                messages.map((m) => <MessageBubble key={m.id} msg={m} />)
              )}
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                gap: 8,
              }}
            >
              <Input.TextArea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={sendMsg.isPending}
              />
            </div>
          </>
        )}
      </div>

      {/* New conversation modal */}
      <Modal
        open={newOpen}
        title="Tin nhắn mới"
        onOk={handleNewThread}
        onCancel={() => {
          setNewOpen(false)
          setUserSearchOptions([])
          form.resetFields()
        }}
        confirmLoading={startThread.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="recipient_id"
            label="Người nhận"
            rules={[{ required: true, message: 'Chọn người nhận' }]}
          >
            <Select
              showSearch
              placeholder="Tìm theo tên hoặc email..."
              filterOption={false}
              onSearch={onSearchUser}
              notFoundContent={
                userSearching ? <Spin size="small" /> : 'Nhập ít nhất 2 ký tự để tìm'
              }
              options={userSearchOptions.map((u) => ({
                value: u.id,
                label: `${u.display_name} · ${u.role} · ${u.email}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="content" label="Tin nhắn" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function MessageBubble({ msg }) {
  // simple: show sender name + content
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        maxWidth: '70%',
      }}
    >
      <Text type="secondary" style={{ fontSize: 11, marginBottom: 2 }}>
        {msg.sender_name} · {dayjs(msg.created_at).format('HH:mm DD/MM')}
      </Text>
      <div
        style={{
          background: '#f0f0f0',
          borderRadius: 12,
          padding: '8px 12px',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}
