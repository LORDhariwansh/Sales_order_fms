import { Component, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';

const fetchChecklists = async () => {
  const { data, error } = await supabase
    .from('checklists')
    .select('*, workflow_stages(stage_name), checklist_items(*)');
  if (error) throw error;
  return data;
};

export const ChecklistsConfig: Component = () => {
  const [checklists] = createResource(fetchChecklists);

  return (
    <div>
      <h2>Workflow Checklists Configuration</h2>
      <p style={{ color: '#666' }}>Define required checklist items and attachment rules for specific stages.</p>

      <Show when={checklists.loading}><p>Loading checklists...</p></Show>

      <div style={{ display: 'grid', gap: '2rem' }}>
        <For each={checklists()}>
          {cl => (
            <div style={{ background: 'white', padding: '1.5rem', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>{cl.name} <small style={{ color: '#888' }}>(Stage: {cl.workflow_stages?.stage_name})</small></h3>
              <table style={{ width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' }}>
                <thead>
                  <tr style={{ 'border-bottom': '1px solid #ccc' }}>
                    <th style={{ padding: '0.5rem' }}>Item Label</th>
                    <th style={{ padding: '0.5rem' }}>Required?</th>
                    <th style={{ padding: '0.5rem' }}>Needs Attachment?</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={cl.checklist_items}>
                    {item => (
                      <tr style={{ 'border-bottom': '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{item.label}</td>
                        <td style={{ padding: '0.5rem', color: item.is_required ? 'red' : 'inherit' }}>{item.is_required ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '0.5rem', color: item.requires_attachment ? '#007bff' : 'inherit' }}>{item.requires_attachment ? 'Yes' : 'No'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <button style={{ 'margin-top': '1rem', padding: '0.5rem', cursor: 'pointer' }}>+ Add Checklist Item</button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
