import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  message,
  Tag,
  Space,
  Typography,
  List,
  Card,
  Empty,
  Input,
  Form,
  Popconfirm
} from 'antd';
import {
  PlayCircleOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import type { TableProps } from 'antd';

const { Text, Paragraph, Title } = Typography;
const { Search } = Input;

// --- API BASE URL ---
// This should point to the port your backend is running on.
// For the local demo (Task 1), it might be 8080 or 8081.
// For the Kubernetes demo (Task 2), it will be the NodePort.
const API_BASE_URL = 'http://localhost:8081/api';

// --- TYPE DEFINITIONS ---
enum Status {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

interface ExecutionLog {
  startTime: string;
  endTime: string;
  output: string;
  status: Status;
  triggeredBy: string;
}

interface HealthCheck {
  id: string;
  name: string;
  owner: string;
  command: string;
  executionLogs: ExecutionLog[];
}

// --- MAIN COMPONENT ---
const HealthCheckDashboard: React.FC = () => {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [filteredData, setFilteredData] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({});
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [selectedHealthCheck, setSelectedHealthCheck] = useState<HealthCheck | null>(null);

  const [form] = Form.useForm();

  // --- API CALLS ---
  const fetchHealthChecks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/health-checks`);
      if (!response.ok) throw new Error('Failed to fetch health checks');
      const data: HealthCheck[] = await response.json();
      data.forEach(hc => hc.executionLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      setHealthChecks(data);
      setFilteredData(data);
    } catch (error) {
      console.error(error);
      message.error('Could not load health check data. Is the backend API running?');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRunCheck = async (id: string) => {
    setRunningChecks(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/health-checks/${id}/run`, { method: 'PUT' });
      if (!response.ok) throw new Error(`Failed to run health check (ID: ${id})`);
      message.success('Health check initiated successfully!');
      setTimeout(fetchHealthChecks, 1500);
    } catch (error) {
      console.error(error);
      message.error('An error occurred while running the health check.');
    } finally {
      setRunningChecks(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAddCheck = async (values: { name: string; owner: string; command: string; }) => {
    try {
        const response = await fetch(`${API_BASE_URL}/health-checks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        if (!response.ok) throw new Error('Failed to create health check');
        message.success('New health check created successfully!');
        setIsFormVisible(false);
        form.resetFields();
        fetchHealthChecks();
    } catch (error) {
        console.error(error);
        message.error('Failed to create new health check.');
    }
  };

  const handleDeleteCheck = async (id: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}/health-checks/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete health check');
        message.success('Health check deleted successfully.');
        fetchHealthChecks();
    } catch (error) {
        console.error(error);
        message.error('Failed to delete health check.');
    }
  };


  // --- UI HANDLERS ---
  const handleViewHistory = (record: HealthCheck) => {
    setSelectedHealthCheck(record);
    setIsHistoryVisible(true);
  };

  const handleSearch = (value: string) => {
    const lowercasedValue = value.toLowerCase();
    const filtered = healthChecks.filter(item =>
      item.name.toLowerCase().includes(lowercasedValue)
    );
    setFilteredData(filtered);
  };


  // --- EFFECTS ---
  useEffect(() => {
    fetchHealthChecks();
  }, [fetchHealthChecks]);

  // --- RENDER HELPERS ---
  const getStatusTag = (status: Status) => {
    const tagMap = {
      [Status.SUCCESS]: { color: 'success', icon: <CheckCircleOutlined /> },
      [Status.FAILED]: { color: 'error', icon: <ExclamationCircleOutlined /> },
      [Status.RUNNING]: { color: 'processing', icon: <SyncOutlined spin /> },
      [Status.PENDING]: { color: 'default', icon: <HistoryOutlined /> },
    };
    return tagMap[status] || { color: 'default' };
  };

  // --- TABLE COLUMN DEFINITIONS ---
  const columns: TableProps<HealthCheck>['columns'] = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name), render: (text) => <Text strong>{text}</Text> },
    { title: 'Owner', dataIndex: 'owner', key: 'owner' },
    { title: 'Command', dataIndex: 'command', key: 'command', render: (command: string) => <Text code>{command}</Text> },
    {
      title: 'Last Status',
      key: 'lastStatus',
      align: 'center',
      render: (_, record) => {
        if (!record.executionLogs.length) return <Tag>Never Run</Tag>;
        const { color, icon } = getStatusTag(record.executionLogs[0].status);
        return <Tag color={color} icon={icon}>{record.executionLogs[0].status}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button type="primary" icon={<PlayCircleOutlined />} loading={runningChecks[record.id]} onClick={() => handleRunCheck(record.id)}>Run</Button>
          <Button icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)}>History</Button>
          <Popconfirm
            title="Delete this task?"
            description="Are you sure you want to delete this health check?"
            onConfirm={() => handleDeleteCheck(record.id)}
            okText="Yes"
            cancelText="No"
            icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        <Card style={{ borderRadius: '8px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Title level={2}>IT Operations Health Check Dashboard</Title>
                <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Search
                        placeholder="Search by name..."
                        allowClear
                        onSearch={handleSearch}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{ width: 400 }}
                        enterButton={<Button icon={<SearchOutlined />} />}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFormVisible(true)}>
                        Add New Health Check
                    </Button>
                </Space>
                <Table
                  columns={columns}
                  dataSource={filteredData}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
            </Space>
        </Card>

      <Modal
        title={`Execution History for "${selectedHealthCheck?.name}"`}
        open={isHistoryVisible}
        onCancel={() => setIsHistoryVisible(false)}
        footer={[<Button key="close" onClick={() => setIsHistoryVisible(false)}>Close</Button>]}
        width={800}
        destroyOnClose
      >
        {selectedHealthCheck?.executionLogs.length ? (
          <List
            itemLayout="vertical"
            dataSource={selectedHealthCheck.executionLogs}
            renderItem={log => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      {(() => {
                        const { color, icon } = getStatusTag(log.status);
                        return <Tag color={color} icon={icon}>{log.status}</Tag>;
                      })()}
                      <Text>Ran at: {new Date(log.startTime).toLocaleString()}</Text>
                    </Space>
                  }
                  description={`Duration: ${((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000).toFixed(2)}s`}
                />
                <Paragraph><strong>Output:</strong></Paragraph>
                <pre style={{ backgroundColor: '#282c34', color: '#abb2bf', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                  {log.output || 'No output captured.'}
                </pre>
              </List.Item>
            )}
          />
        ) : <Empty description="No execution history found." />}
      </Modal>

      <Modal
        title="Add New Health Check"
        open={isFormVisible}
        onCancel={() => setIsFormVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddCheck} style={{ marginTop: '24px' }}>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a name for the health check.' }]}>
                <Input placeholder="e.g., Google DNS Ping" />
            </Form.Item>
            <Form.Item name="owner" label="Owner" rules={[{ required: true, message: 'Please enter an owner.' }]}>
                <Input placeholder="e.g., DevOps Team" />
            </Form.Item>
            <Form.Item name="command" label="Command" rules={[{ required: true, message: 'Please enter a valid command.' }]}>
                <Input placeholder="e.g., ping -c 4 google.com" />
            </Form.Item>
            <Form.Item style={{ textAlign: 'right' }}>
                <Space>
                    <Button onClick={() => setIsFormVisible(false)}>Cancel</Button>
                    <Button type="primary" htmlType="submit">Create</Button>
                </Space>
            </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

// --- App Wrapper for Ant Design Context ---
const App: React.FC = () => {
    const [, contextHolder] = message.useMessage();
    return (
        <>
            {contextHolder}
            <HealthCheckDashboard />
        </>
    );
};

export default App;

