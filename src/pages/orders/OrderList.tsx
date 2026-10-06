import { Component, createSignal, createResource, For } from 'solid-js';
import { A } from '@solidjs/router';
import { fetchOrders, OrderFilter } from '../../services/orders';
import { calculateSLAStatus } from '../../services/workflow';

export const OrderList: Component = () => {
  const [filters, setFilters] = createSignal<OrderFilter>({ page: 1, pageSize: 10, isArchived: false });
  const [data] = createResource(filters, fetchOrders);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-bottom': '1rem' }}>
        <h2>Order Management</h2>
        <A href="/orders/new"><button>+ New Order</button></A>
      </div>

      <div style={{ display: 'flex', gap: '1rem', 'margin-bottom': '2rem', padding: '1rem', background: '#f5f5f5' }}>
        <input 
          placeholder="Search Record Number..." 
          onInput={(e) => setFilters({ ...filters(), search: e.currentTarget.value, page: 1 })}
        />
        <select onChange={(e) => setFilters({ ...filters(), status: e.currentTarget.value || undefined, page: 1 })}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <label>
          <input 
            type="checkbox" 
            checked={filters().isArchived} 
            onChange={(e) => setFilters({ ...filters(), isArchived: e.currentTarget.checked, page: 1 })}
          /> Show Archived
        </label>
      </div>

      {data.loading && <p>Loading orders from database...</p>}
      
      <table style={{ width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' }}>
        <thead>
          <tr style={{ 'border-bottom': '2px solid #ccc' }}>
            <th>Record No</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Salesman</th>
            <th>Status</th>
            <th>Active Stage SLA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <For each={data()?.data}>
            {(order) => {
              // Find the currently active stage
              const activeStage = order.order_stages?.find((s: any) => s.status === 'Pending' || s.status === 'In Progress');
              const sla = activeStage ? calculateSLAStatus(activeStage.planned_date, null) : 'N/A';
              const slaColor = sla === 'OVERDUE' ? 'red' : sla === 'DUE_SOON' ? 'orange' : 'green';

              return (
                <tr style={{ 'border-bottom': '1px solid #eee' }}>
                  <td>{order.submission_id}</td>
                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>{order.customers?.name}</td>
                  <td>{order.profiles?.full_name}</td>
                  <td>{order.status}</td>
                  <td style={{ color: activeStage ? slaColor : 'inherit' }}>
                    {activeStage ? sla : 'Completed'}
                  </td>
                  <td>
                    <A href={/orders/}>View</A>
                  </td>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
      
      <div style={{ 'margin-top': '1rem', display: 'flex', gap: '1rem' }}>
        <button 
          disabled={filters().page === 1} 
          onClick={() => setFilters({ ...filters(), page: (filters().page || 1) - 1 })}
        >
          Previous
        </button>
        <span>Page {filters().page}</span>
        <button 
          disabled={!data()?.data || data()!.data.length < (filters().pageSize || 10)}
          onClick={() => setFilters({ ...filters(), page: (filters().page || 1) + 1 })}
        >
          Next
        </button>
      </div>
    </div>
  );
};
