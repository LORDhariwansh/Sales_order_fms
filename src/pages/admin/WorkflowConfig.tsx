import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';

const fetchWorkflow = async () => {
  const [stages, roles] = await Promise.all([
    supabase.from('workflow_stages').select('*, roles(name)').order('sequence_order', { ascending: true }),
    supabase.from('roles').select('*')
  ]);
  if (stages.error) throw stages.error;
  return { stages: stages.data, roles: roles.data };
};

export const WorkflowConfig: Component = () => {
  const [data, { refetch }] = createResource(fetchWorkflow);
  const [updating, setUpdating] = createSignal<string | null>(null);

  const updateTAT = async (stageId: string, hours: number) => {
    setUpdating(stageId);
    try {
      const { error } = await supabase.from('workflow_stages').update({ tat_hours: hours }).eq('id', stageId);
      if (error) throw error;
      refetch();
    } catch (err: any) {
      alert("Failed to update TAT: " + err.message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h2>Workflow & TAT Configuration</h2>
      <p style={{ color: '#666' }}>Manage the core state machine stages and SLA times (in business hours).</p>

      <Show when={data.loading}><p>Loading engine configurations...</p></Show>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <For each={data()?.stages}>
          {stage => (
            <div style={{ background: 'white', padding: '1rem', 'border-radius': '8px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0' }}>{stage.sequence_order}. {stage.stage_name}</h3>
                <small style={{ color: '#888' }}>Assigned Role: {stage.roles?.name}</small>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center' }}>
                <label><strong>TAT (Hours):</strong></label>
                <input 
                  type="number" 
                  min="1" 
                  value={stage.tat_hours}
                  onBlur={(e) => {
                    const val = parseInt(e.currentTarget.value);
                    if (val !== stage.tat_hours && !isNaN(val)) updateTAT(stage.id, val);
                  }}
                  style={{ width: '80px', padding: '0.5rem' }}
                  disabled={updating() === stage.id}
                />
                <Show when={updating() === stage.id}><small>Saving...</small></Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
