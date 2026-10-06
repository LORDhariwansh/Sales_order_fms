import { Component, createResource, For, Show } from 'solid-js';
import { supabase } from '../../lib/supabase';

const fetchUsersConfig = async () => {
  const [users, roles, teams] = await Promise.all([
    supabase.from('profiles').select('*, user_roles(role_id, roles(name)), team_members(team_id, teams(name))'),
    supabase.from('roles').select('*'),
    supabase.from('teams').select('*')
  ]);
  return { users: users.data, roles: roles.data, teams: teams.data };
};

export const UsersConfig: Component = () => {
  const [data] = createResource(fetchUsersConfig);

  return (
    <div>
      <h2>Users, Roles & Teams Configuration</h2>
      <Show when={data.loading}><p>Loading user configurations...</p></Show>

      <table style={{ width: '100%', background: 'white', 'border-collapse': 'collapse', 'box-shadow': '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ 'border-bottom': '2px solid #eee', 'text-align': 'left' }}>
            <th style={{ padding: '1rem' }}>User / Email</th>
            <th style={{ padding: '1rem' }}>Assigned Roles</th>
            <th style={{ padding: '1rem' }}>Assigned Teams</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          <For each={data()?.users}>
            {user => (
              <tr style={{ 'border-bottom': '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>
                  <strong>{user.full_name}</strong><br/>
                  <small>{user.email}</small>
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.user_roles?.map((ur: any) => ur.roles?.name).join(', ') || 'No Roles'}
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.team_members?.map((tm: any) => tm.teams?.name).join(', ') || 'No Teams'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <button style={{ padding: '0.25rem 0.5rem', cursor: 'pointer' }}>Manage Access</button>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};
