import { Component, createResource, For, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { fetchOrderById } from '../../services/orders';
import { calculateSLAStatus } from '../../services/workflow';

export const OrderDetail: Component = () => {
  const params = useParams();
  const [data] = createResource(params.id, fetchOrderById);

  return (
    <div style={{ padding: '2rem' }}>
      <Show when={data.loading}>
        <p>Loading order details from database...</p>
      </Show>
      
      <Show when={data()}>
        {(order) => {
          // Sort stages by sequence
          const sortedStages = order().order_stages?.sort((a: any, b: any) => 
            a.workflow_stages.sequence_order - b.workflow_stages.sequence_order
          ) || [];

          return (
            <div>
              <header style={{ 'border-bottom': '2px solid #ccc', 'padding-bottom': '1rem', 'margin-bottom': '2rem' }}>
                <h2>Order: {order().submission_id}</h2>
                <p><strong>Customer:</strong> {order().customers?.name}</p>
                <p><strong>Salesman:</strong> {order().profiles?.full_name}</p>
                <p><strong>Status:</strong> {order().status} {order().is_archived ? '(Archived)' : ''}</p>
              </header>

              <section style={{ 'margin-bottom': '2rem' }}>
                <h3>Workflow Timeline</h3>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem', background: '#f9f9f9', padding: '1rem' }}>
                  <For each={sortedStages}>
                    {(stage: any) => {
                      const sla = calculateSLAStatus(stage.planned_date, stage.actual_date);
                      return (
                        <div style={{ border: '1px solid #ddd', padding: '1rem', background: 'white' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0' }}>{stage.workflow_stages?.stage_name}</h4>
                          <p style={{ margin: 0 }}><strong>Status:</strong> {stage.status}</p>
                          <p style={{ margin: 0 }}><strong>Due:</strong> {stage.planned_date ? new Date(stage.planned_date).toLocaleString() : 'N/A'} - (SLA: {sla})</p>
                          {stage.actual_date && <p style={{ margin: 0 }}><strong>Completed:</strong> {new Date(stage.actual_date).toLocaleString()}</p>}
                          
                          <Show when={stage.status === 'Pending'}>
                            <button style={{ 'margin-top': '1rem' }}>Action Required: Complete Stage</button>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </section>

              <div style={{ display: 'flex', gap: '2rem' }}>
                <section style={{ flex: 1 }}>
                  <h3>Documents</h3>
                  <ul>
                    <For each={order().documents} fallback={<li>No documents uploaded.</li>}>
                      {doc => <li><a href={doc.storage_path} target="_blank" rel="noopener noreferrer">{doc.document_type}</a></li>}
                    </For>
                  </ul>
                </section>

                <section style={{ flex: 1 }}>
                  <h3>Audit History</h3>
                  <div style={{ 'max-height': '300px', 'overflow-y': 'auto', border: '1px solid #ccc', padding: '1rem' }}>
                    <For each={order().audit_logs} fallback={<p>No audit activity found.</p>}>
                      {log => (
                        <div style={{ 'border-bottom': '1px solid #eee', 'margin-bottom': '0.5rem', 'padding-bottom': '0.5rem' }}>
                          <small>{new Date(log.created_at).toLocaleString()}</small>
                          <div><strong>{log.action}</strong></div>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
};
