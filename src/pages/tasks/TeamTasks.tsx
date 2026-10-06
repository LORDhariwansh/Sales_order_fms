import { Component, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const fetchTeamTasks = async (userId: string) => {
  // First get user's teams
  const { data: teamsData } = await supabase.from('team_members').select('team_id').eq('user_id', userId);
  const teamIds = teamsData?.map(t => t.team_id) || [];

  if (teamIds.length === 0) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*, orders(submission_id), teams(name)')
    .in('assigned_team_id', teamIds)
    .order('due_at', { ascending: true });

  if (error) throw error;
  return data;
};

export const TeamTasks: Component = () => {
  const auth = useAuth();
  const [tasks] = createResource(() => auth.user?.id, fetchTeamTasks);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Team Tasks Dashboard</h2>
      <Show when={tasks.loading}><p>Loading team tasks...</p></Show>
      
      <Show when={tasks()}>
        <table style={{ width: '100%', 'border-collapse': 'collapse', 'text-align': 'left' }}>
          <thead>
            <tr style={{ 'border-bottom': '2px solid #ddd' }}>
              <th>Order</th>
              <th>Task</th>
              <th>Team</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            <For each={tasks()} fallback={<tr><td colspan="5">No team tasks found.</td></tr>}>
              {(task) => (
                <tr style={{ 'border-bottom': '1px solid #eee' }}>
                  <td>{task.orders?.submission_id}</td>
                  <td>{task.step || 'Workflow Task'}</td>
                  <td>{task.teams?.name}</td>
                  <td>{task.status}</td>
                  <td style={{ color: new Date(task.due_at) < new Date() && task.status === 'Pending' ? 'red' : 'inherit' }}>
                    {new Date(task.due_at).toLocaleString()}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
};
