import { Component } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Unauthorized } from './pages/Unauthorized';
import { OrderList } from './pages/orders/OrderList';
import { OrderCreate } from './pages/orders/OrderCreate';
import { OrderDetail } from './pages/orders/OrderDetail';
import { MyTasks } from './pages/tasks/MyTasks';
import { TeamTasks } from './pages/tasks/TeamTasks';
import { NotificationsWidget } from './components/Notifications';
import { AdminLayout } from './pages/admin/AdminLayout';
import { HolidaysConfig } from './pages/admin/HolidaysConfig';
import { WorkflowConfig } from './pages/admin/WorkflowConfig';
import { UsersConfig } from './pages/admin/UsersConfig';
import { ChecklistsConfig } from './pages/admin/ChecklistsConfig';
import { MasterDataConfig } from './pages/admin/MasterDataConfig';

const App: Component = () => {
  return (
    <AuthProvider>
      <div style={{ position: 'fixed', top: 10, right: 10, 'z-index': 9999 }}>
        <NotificationsWidget />
      </div>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/unauthorized" component={Unauthorized} />
        
        <Route path="/" component={() => <ProtectedRoute><Dashboard /></ProtectedRoute>} />
        
        <Route path="/orders" component={() => <ProtectedRoute><OrderList /></ProtectedRoute>} />
        <Route path="/orders/new" component={() => <ProtectedRoute requiredRoles={['Create', 'Admin', 'MIS']}><OrderCreate /></ProtectedRoute>} />
        <Route path="/orders/:id" component={() => <ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        
        <Route path="/tasks/my" component={() => <ProtectedRoute><MyTasks /></ProtectedRoute>} />
        <Route path="/tasks/team" component={() => <ProtectedRoute requiredRoles={['Admin', 'MIS', 'CA', 'SC', 'Pricelist', 'EA']}><TeamTasks /></ProtectedRoute>} />

        {/* Admin Configuration Routes */}
        <Route path="/admin" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}>
            <AdminLayout>
              <div>Please select a configuration section from the sidebar.</div>
            </AdminLayout>
          </ProtectedRoute>
        )} />
        <Route path="/admin/holidays" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}><AdminLayout><HolidaysConfig /></AdminLayout></ProtectedRoute>
        )} />
        <Route path="/admin/workflow" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}><AdminLayout><WorkflowConfig /></AdminLayout></ProtectedRoute>
        )} />
        <Route path="/admin/users" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}><AdminLayout><UsersConfig /></AdminLayout></ProtectedRoute>
        )} />
        <Route path="/admin/checklists" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}><AdminLayout><ChecklistsConfig /></AdminLayout></ProtectedRoute>
        )} />
        <Route path="/admin/master-data" component={() => (
          <ProtectedRoute requiredRoles={['MIS', 'Admin']}><AdminLayout><MasterDataConfig /></AdminLayout></ProtectedRoute>
        )} />
      </Router>
    </AuthProvider>
  );
};

export default App;
