import { Component, createSignal, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface StageChecklistProps {
  orderStageId: string;
  stageId: string;
  stageName: string;
  responsibleRole: string;
  status: string;
  plannedDate: string;
  onCompleted: () => void;
}

const fetchChecklist = async (stageId: string) => {
  const { data, error } = await supabase
    .from('checklists')
    .select('id, name, checklist_items(*)')
    .eq('stage_id', stageId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // Ignore not found if no checklist
  return data;
};

export const StageChecklist: Component<StageChecklistProps> = (props) => {
  const auth = useAuth();
  const [checklist] = createResource(() => props.stageId, fetchChecklist);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  
  // Local state for answers before submitting
  const [answers, setAnswers] = createSignal<Record<string, { completed: boolean, remarks: string, attachment: string }>>({});

  const updateAnswer = (itemId: string, field: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { completed: false, remarks: '', attachment: '' }), [field]: value }
    }));
  };

  const handleComplete = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Sync checklist answers to DB
      if (checklist()) {
        // Ensure order_checklist exists
        const { data: ocData, error: ocError } = await supabase
          .from('order_checklists')
          .upsert({ order_stage_id: props.orderStageId, checklist_id: checklist().id }, { onConflict: 'order_stage_id, checklist_id' })
          .select('id')
          .single();
          
        if (ocError) throw ocError;

        const itemsToInsert = Object.keys(answers()).map(itemId => ({
          order_checklist_id: ocData.id,
          item_id: itemId,
          is_completed: answers()[itemId].completed,
          remarks: answers()[itemId].remarks,
          attachment_url: answers()[itemId].attachment,
          completed_by: answers()[itemId].completed ? auth.user?.id : null,
          completed_at: answers()[itemId].completed ? new Date().toISOString() : null
        }));

        if (itemsToInsert.length > 0) {
          const { error: insErr } = await supabase.from('order_checklist_items').upsert(itemsToInsert, { onConflict: 'order_checklist_id, item_id' });
          if (insErr) throw insErr;
        }
      }

      // 2. Call Complete Stage RPC
      const { error: rpcErr } = await supabase.rpc('complete_stage_advanced', {
        p_order_stage_id: props.orderStageId,
        p_user_id: auth.user?.id
      });
      if (rpcErr) throw rpcErr;

      props.onCompleted();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isAssigned = auth.profile?.roles.includes(props.responsibleRole);

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', 'border-radius': '8px', 'margin-bottom': '1rem' }}>
      <header style={{ display: 'flex', 'justify-content': 'space-between', 'border-bottom': '1px solid #eee', 'padding-bottom': '0.5rem' }}>
        <h3 style={{ margin: 0 }}>{props.stageName}</h3>
        <span style={{ 
          background: props.status === 'Completed' ? 'green' : props.status === 'Pending' ? 'orange' : '#ccc', 
          color: 'white', padding: '0.25rem 0.5rem', 'border-radius': '4px' 
        }}>
          {props.status}
        </span>
      </header>
      
      <div style={{ 'margin-top': '1rem', 'font-size': '0.9rem', color: '#555' }}>
        <p><strong>Responsible:</strong> {props.responsibleRole}</p>
        <p><strong>Deadline:</strong> {new Date(props.plannedDate).toLocaleString()}</p>
      </div>

      <Show when={checklist() && props.status !== 'Completed'}>
        <div style={{ 'margin-top': '1rem', background: '#f9f9f9', padding: '1rem' }}>
          <h4>{checklist().name}</h4>
          <For each={checklist().checklist_items}>
            {(item: any) => (
              <div style={{ 'margin-bottom': '1rem', padding: '0.5rem', border: '1px solid #ddd', background: '#fff' }}>
                <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem', 'font-weight': 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={answers()[item.id]?.completed || false}
                    onChange={(e) => updateAnswer(item.id, 'completed', e.currentTarget.checked)}
                  />
                  {item.label} {item.is_required && <span style={{ color: 'red' }}>*</span>}
                </label>
                
                <Show when={item.requires_attachment}>
                  <div style={{ 'margin-top': '0.5rem' }}>
                    <input 
                      type="url" 
                      placeholder="Attachment URL required..." 
                      style={{ width: '100%', padding: '0.25rem' }}
                      value={answers()[item.id]?.attachment || ''}
                      onInput={(e) => updateAnswer(item.id, 'attachment', e.currentTarget.value)}
                    />
                  </div>
                </Show>
                
                <div style={{ 'margin-top': '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="Remarks (Optional)" 
                    style={{ width: '100%', padding: '0.25rem' }}
                    value={answers()[item.id]?.remarks || ''}
                    onInput={(e) => updateAnswer(item.id, 'remarks', e.currentTarget.value)}
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {errorMsg() && <div style={{ color: 'red', 'margin-top': '1rem', padding: '0.5rem', border: '1px solid red' }}><strong>Error:</strong> {errorMsg()}</div>}

      <Show when={props.status === 'Pending' && isAssigned}>
        <button 
          onClick={handleComplete} 
          disabled={loading()}
          style={{ 'margin-top': '1rem', padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {loading() ? 'Processing...' : 'Complete Stage'}
        </button>
      </Show>
    </div>
  );
};
