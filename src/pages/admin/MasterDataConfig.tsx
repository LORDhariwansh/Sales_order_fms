import { Component, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';

const fetchMasterData = async () => {
  const [customers, transporters] = await Promise.all([
    supabase.from('customers').select('*').limit(20),
    supabase.from('transporters').select('*').limit(20)
  ]);
  return { customers: customers.data, transporters: transporters.data };
};

export const MasterDataConfig: Component = () => {
  const [data] = createResource(fetchMasterData);

  return (
    <div>
      <h2>Master Data & Dropdowns</h2>
      <p style={{ color: '#666' }}>Manage core system entities like Customers and Transporters.</p>

      <Show when={data.loading}><p>Loading master data...</p></Show>

      <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '2rem' }}>
        <div style={{ background: 'white', padding: '1rem', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Customers</h3>
          <ul style={{ padding: 0, 'list-style': 'none' }}>
            <For each={data()?.customers}>
              {c => <li style={{ padding: '0.5rem 0', 'border-bottom': '1px solid #eee' }}>{c.name} <small>({c.customer_code})</small></li>}
            </For>
          </ul>
          <button style={{ 'margin-top': '1rem' }}>+ Add Customer</button>
        </div>

        <div style={{ background: 'white', padding: '1rem', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Transporters</h3>
          <ul style={{ padding: 0, 'list-style': 'none' }}>
            <For each={data()?.transporters}>
              {t => <li style={{ padding: '0.5rem 0', 'border-bottom': '1px solid #eee' }}>{t.name}</li>}
            </For>
          </ul>
          <button style={{ 'margin-top': '1rem' }}>+ Add Transporter</button>
        </div>
      </div>
    </div>
  );
};
