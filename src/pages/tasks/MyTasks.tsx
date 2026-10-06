import { Component, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateSLAStatus } from '../../services/workflow';

const fetchMyTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, orders(submission_id)')
    .eq('assigned_user_id', userId)
    .order('due_at', { ascending: true });

  if (error) throw error;
  
  // Categorize
  const pending = data.filter(t => t.status === 'Pending' && calculateSLAStatus(t.due_at, null) !== 'DUE_SOON' && calculateSLAStatus(t.due_at, null) !== 'OVERDUE');
  const dueSoon = data.filter(t => t.status === 'Pending' && calculateSLAStatus(t.due_at, null) === 'DUE_SOON');
  const overdue = data.filter(t => t.status === 'Pending' && calculateSLAStatus(t.due_at, null) === 'OVERDUE');
  const completed = data.filter(t => t.status === 'Completed');

  return { pending, dueSoon, overdue, completed };
};

export const MyTasks: Component = () => {
  const auth = useAuth();
  const [tasks] = createResource(() => auth.user?.id, fetchMyTasks);

  const TaskCard = (props: { task: any, color: string }) => (
    <div style={{ border: `1px solid ${props.color}`, padding: '1rem', 'border-radius': '4px', 'margin-bottom': '0.5rem', background: '#fff' }}>
      <h4 style={{ margin: '0 0 0.5rem 0' }}>Order: {props.task.orders?.submission_id}</h4>
      <p style={{ margin: 0 }}><strong>Task:</strong> {props.task.step || 'Workflow Task'}</p>
      <p style={{ margin: 0, color: props.color }}><strong>Due:</strong> {new Date(props.task.due_at).toLocaleString()}</p>
    </div>
  );

  return (
    <div style={{ padding: '2rem' }}>
      <h2>My Tasks</h2>
      <Show when={tasks.loading}><p>Loading your tasks...</p></Show>
      
      <Show when={tasks()}>
        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          <div>
            <h3 style={{ color: 'red' }}>Overdue ({tasks()?.overdue.length})</h3>
            <For each={tasks()?.overdue}>{t => <TaskCard task={t} color="red" />}</For>
          </div>
          <div>
            <h3 style={{ color: 'orange' }}>Due Soon ({tasks()?.dueSoon.length})</h3>
            <For each={tasks()?.dueSoon}>{t => <TaskCard task={t} color="orange" />}</For>
          </div>
          <div>
            <h3 style={{ color: '#007bff' }}>Pending ({tasks()?.pending.length})</h3>
            <For each={tasks()?.pending}>{t => <TaskCard task={t} color="#007bff" />}</For>
          </div>
          <div>
            <h3 style={{ color: 'green' }}>Completed ({tasks()?.completed.length})</h3>
            <For each={tasks()?.completed}>{t => <TaskCard task={t} color="green" />}</For>
          </div>
        </div>
      </Show>
    </div>
  );
};
