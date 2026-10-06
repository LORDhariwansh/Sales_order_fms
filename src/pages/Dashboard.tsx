import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const fetchDashboardMetrics = async (filters: any) => {
  const { data, error } = await supabase.rpc('get_dashboard_metrics', {
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_salesman_id: filters.salesmanId || null,
    p_customer_id: filters.customerId || null
  });
  if (error) throw error;
  return data;
};

const exportCSV = async (filters: any) => {
  let query = supabase.from('fms_export_report').select('*').csv();
  
  // Basic filtering for export
  if (filters.startDate) query = query.gte('Order Date', filters.startDate);
  if (filters.endDate) query = query.lte('Order Date', filters.endDate);
  
  const { data, error } = await query;
  if (error) {
    alert("Export failed: " + error.message);
    return;
  }

  const blob = new Blob([data as string], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', FMS_Report_\.csv);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const Dashboard: Component = () => {
  const { profile } = useAuth();
  
  const [filters, setFilters] = createSignal({
    startDate: '',
    endDate: '',
    salesmanId: '',
    customerId: ''
  });

  const [metrics] = createResource(filters, fetchDashboardMetrics);

  const calculateSLA = (slaData: any[]) => {
    if (!slaData || slaData.length === 0 || slaData[0].total_evaluated === 0) return '0%';
    return ((slaData[0].on_time / slaData[0].total_evaluated) * 100).toFixed(1) + '%';
  };

  const MetricCard = (props: { title: string, value: string | number, color?: string }) => (
    <div style={{ padding: '1.5rem', background: 'white', 'border-radius': '8px', 'box-shadow': '0 2px 4px rgba(0,0,0,0.1)', 'border-left': 4px solid \ }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>{props.title}</h4>
      <div style={{ 'font-size': '2rem', 'font-weight': 'bold', color: '#333' }}>{props.value}</div>
    </div>
  );

  return (
    <div style={{ padding: '2rem', background: '#f5f7fa', 'min-height': '100vh' }}>
      <header style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '2rem' }}>
        <h2>Dashboard & Analytics</h2>
        <button onClick={() => exportCSV(filters())} style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
          📥 Export CSV Report
        </button>
      </header>

      {/* Global Filters */}
      <div style={{ display: 'flex', gap: '1rem', 'margin-bottom': '2rem', background: 'white', padding: '1rem', 'border-radius': '8px' }}>
        <div>
          <label>Start Date: </label>
          <input type="date" onInput={e => setFilters({...filters(), startDate: e.currentTarget.value})} />
        </div>
        <div>
          <label>End Date: </label>
          <input type="date" onInput={e => setFilters({...filters(), endDate: e.currentTarget.value})} />
        </div>
        {/* Dropdowns for Customer/Salesman would be dynamically populated here */}
      </div>

      <Show when={metrics.loading}>
        <p>Calculating database metrics...</p>
      </Show>

      <Show when={metrics()}>
        {/* KPI Row */}
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', 'margin-bottom': '2rem' }}>
          <MetricCard title="Total Orders" value={metrics().overview.total} />
          <MetricCard title="Active Orders" value={metrics().overview.active} color="orange" />
          <MetricCard title="Completed" value={metrics().overview.completed} color="green" />
          <MetricCard title="SLA Compliance" value={calculateSLA(metrics().sla)} color="purple" />
        </div>

        <div style={{ display: 'flex', gap: '2rem' }}>
          {/* Bottlenecks / Stage Metrics */}
          <div style={{ flex: 2, background: 'white', padding: '1.5rem', 'border-radius': '8px' }}>
            <h3>Workflow Stage Bottlenecks</h3>
            <table style={{ width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' }}>
              <thead>
                <tr style={{ 'border-bottom': '2px solid #eee' }}>
                  <th>Stage</th>
                  <th>Pending Queue</th>
                  <th>Overdue</th>
                </tr>
              </thead>
              <tbody>
                <For each={metrics().by_stage}>
                  {(stage: any) => (
                    <tr style={{ 'border-bottom': '1px solid #f9f9f9' }}>
                      <td>{stage.stage_name}</td>
                      <td>{stage.pending_count}</td>
                      <td style={{ color: stage.overdue_count > 0 ? 'red' : 'inherit', 'font-weight': stage.overdue_count > 0 ? 'bold' : 'normal' }}>
                        {stage.overdue_count}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          {/* Salesman Performance */}
          <div style={{ flex: 1, background: 'white', padding: '1.5rem', 'border-radius': '8px' }}>
            <h3>Orders by Salesman</h3>
            <ul style={{ 'list-style': 'none', padding: 0 }}>
              <For each={metrics().by_salesman}>
                {(sm: any) => (
                  <li style={{ display: 'flex', 'justify-content': 'space-between', 'padding-bottom': '0.5rem', 'border-bottom': '1px solid #eee', 'margin-bottom': '0.5rem' }}>
                    <span>{sm.full_name}</span>
                    <strong>{sm.order_count}</strong>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>
      </Show>
    </div>
  );
};
