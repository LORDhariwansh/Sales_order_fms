import { Component, JSX } from 'solid-js';
import { A } from '@solidjs/router';

export const AdminLayout: Component<{ children: JSX.Element }> = (props) => {
  return (
    <div style={{ display: 'flex', 'min-height': '100vh', background: '#f5f7fa' }}>
      <aside style={{ width: '250px', background: '#2c3e50', color: 'white', padding: '2rem 1rem' }}>
        <h2 style={{ 'margin-top': 0, 'border-bottom': '1px solid #34495e', 'padding-bottom': '1rem' }}>FMS Admin Panel</h2>
        <nav style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem', 'margin-top': '2rem' }}>
          <A href="/admin/users" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Users & Roles</A>
          <A href="/admin/teams" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Teams</A>
          <A href="/admin/workflow" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Workflow & TAT</A>
          <A href="/admin/checklists" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Checklists</A>
          <A href="/admin/holidays" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Holidays Calendar</A>
          <A href="/admin/master-data" class="admin-link" style={{ color: 'white', 'text-decoration': 'none' }}>Master Data / Dropdowns</A>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '2rem' }}>
        {props.children}
      </main>
    </div>
  );
};
