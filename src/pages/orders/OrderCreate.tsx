import { Component, createSignal, createResource, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { supabase } from '../../lib/supabase';
import { createOrder } from '../../services/orders';
import { useAuth } from '../../contexts/AuthContext';

const fetchFormData = async () => {
  const [customers, stages] = await Promise.all([
    supabase.from('customers').select('id, name').order('name'),
    supabase.from('workflow_stages').select('id, stage_name').eq('sequence_order', 1).single()
  ]);
  return { customers: customers.data, firstStage: stages.data };
};

export const OrderCreate: Component = () => {
  const [data] = createResource(fetchFormData);
  const auth = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = createSignal({
    submission_id: '',
    customer_id: '',
    delivery_address_id: '00000000-0000-0000-0000-000000000000', // Mock UUID for compilation, real app fetches addresses based on customer
    cn_applicable: false,
  });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const firstStageId = data()?.firstStage?.id;
      if (!firstStageId) throw new Error("Workflow not configured properly in DB.");

      const payload = {
        ...form(),
        salesman_id: auth.user?.id
      };

      const orderId = await createOrder(payload, firstStageId);
      navigate(`/orders/${orderId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', "max-width": '600px' }}>
      <h2>Create New Order</h2>
      {data.loading ? <p>Loading master data...</p> : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
          <div>
            <label>Record Number (Submission ID)</label>
            <input 
              type="text" required style={{ width: '100%', padding: '0.5rem' }}
              value={form().submission_id}
              onInput={e => setForm({ ...form(), submission_id: e.currentTarget.value })}
            />
          </div>
          <div>
            <label>Customer</label>
            <select 
              required style={{ width: '100%', padding: '0.5rem' }}
              value={form().customer_id}
              onChange={e => setForm({ ...form(), customer_id: e.currentTarget.value })}
            >
              <option value="">Select Customer...</option>
              <For each={data()?.customers}>
                {c => <option value={c.id}>{c.name}</option>}
              </For>
            </select>
          </div>
          <div>
            <label>
              <input 
                type="checkbox" 
                checked={form().cn_applicable}
                onChange={e => setForm({ ...form(), cn_applicable: e.currentTarget.checked })}
              /> Credit Note Applicable?
            </label>
          </div>

          {error() && <div style={{ color: 'red' }}>{error()}</div>}

          <button type="submit" disabled={loading()} style={{ padding: '1rem' }}>
            {loading() ? 'Saving...' : 'Initialize Order & Workflow'}
          </button>
        </form>
      )}
    </div>
  );
};
