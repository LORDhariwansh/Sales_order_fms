import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';

const fetchHolidays = async () => {
  const { data, error } = await supabase.from('holidays').select('*').order('holiday_date', { ascending: true });
  if (error) throw error;
  return data;
};

export const HolidaysConfig: Component = () => {
  const [holidays, { refetch }] = createResource(fetchHolidays);
  const [form, setForm] = createSignal({ date: '', description: '' });
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');

  const handleAdd = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.from('holidays').insert({
        holiday_date: form().date,
        description: form().description
      });
      if (error) throw error;
      setForm({ date: '', description: '' });
      refetch();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove holiday? This will affect future SLA calculations.")) return;
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) alert(error.message);
    else refetch();
  };

  return (
    <div>
      <h2>Holidays Configuration</h2>
      <p style={{ color: '#666' }}>Dates added here are automatically skipped by the server-side SLA TAT engine.</p>
      
      <div style={{ background: 'white', padding: '1rem', 'border-radius': '8px', 'margin-bottom': '2rem', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', 'align-items': 'center' }}>
          <input type="date" required value={form().date} onInput={e => setForm({...form(), date: e.currentTarget.value})} />
          <input type="text" placeholder="Description (e.g. Diwali)" required value={form().description} onInput={e => setForm({...form(), description: e.currentTarget.value})} style={{ flex: 1, padding: '0.5rem' }} />
          <button type="submit" disabled={loading()}>{loading() ? 'Saving...' : 'Add Holiday'}</button>
        </form>
        {errorMsg() && <div style={{ color: 'red', 'margin-top': '0.5rem' }}>{errorMsg()}</div>}
      </div>

      <Show when={holidays.loading}><p>Loading holidays...</p></Show>
      
      <table style={{ width: '100%', background: 'white', 'border-collapse': 'collapse', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ 'border-bottom': '2px solid #eee', 'text-align': 'left' }}>
            <th style={{ padding: '1rem' }}>Date</th>
            <th style={{ padding: '1rem' }}>Description</th>
            <th style={{ padding: '1rem', width: '100px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          <For each={holidays()} fallback={<tr><td colspan="3" style={{ padding: '1rem' }}>No holidays configured.</td></tr>}>
            {holiday => (
              <tr style={{ 'border-bottom': '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>{new Date(holiday.holiday_date).toLocaleDateString()}</td>
                <td style={{ padding: '1rem' }}>{holiday.description}</td>
                <td style={{ padding: '1rem' }}>
                  <button onClick={() => handleDelete(holiday.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
