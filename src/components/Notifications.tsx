import { Component, createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const NotificationsWidget: Component = () => {
  const auth = useAuth();
  const [notifications, setNotifications] = createSignal<any[]>([]);
  const [unreadCount, setUnreadCount] = createSignal(0);
  const [open, setOpen] = createSignal(false);

  const loadInitial = async () => {
    if (!auth.user?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .or(user_id.eq.\) // Add team logic if needed
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  createEffect(() => {
    loadInitial();

    if (auth.user?.id) {
      const channel = supabase.channel('public:notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: user_id=eq.\ 
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10));
          setUnreadCount(c => c + 1);
        })
        .subscribe();

      onCleanup(() => {
        supabase.removeChannel(channel);
      });
    }
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open())} style={{ padding: '0.5rem' }}>
        🔔 <Show when={unreadCount() > 0}><span style={{ color: 'red', 'font-weight': 'bold' }}>({unreadCount()})</span></Show>
      </button>

      <Show when={open()}>
        <div style={{ position: 'absolute', right: 0, top: '100%', width: '300px', background: 'white', border: '1px solid #ccc', 'box-shadow': '0 4px 6px rgba(0,0,0,0.1)', 'z-index': 1000 }}>
          <h4 style={{ margin: 0, padding: '0.5rem', 'border-bottom': '1px solid #eee', background: '#f9f9f9' }}>Notifications</h4>
          <div style={{ 'max-height': '300px', 'overflow-y': 'auto' }}>
            <For each={notifications()} fallback={<div style={{ padding: '1rem', 'text-align': 'center' }}>No notifications</div>}>
              {n => (
                <div 
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  style={{ padding: '0.5rem', 'border-bottom': '1px solid #eee', background: n.is_read ? 'white' : '#e6f2ff', cursor: 'pointer' }}
                >
                  <small style={{ color: '#888' }}>{new Date(n.created_at).toLocaleTimeString()}</small>
                  <p style={{ margin: '0.25rem 0 0 0', 'font-size': '0.9rem' }}>{n.message}</p>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};
