import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('lue', false)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setNotifications(data || []);
        setCount((data || []).length);
      });
  }, [profile]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ lue: true }).eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ lue: true }).in('id', ids);
    setNotifications([]);
    setCount(0);
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "a l'instant";
    if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
    if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
    return `il y a ${Math.floor(seconds / 86400)}j`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={18} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 bg-gray-900 border-white/10"
        align="end"
      >
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Notifications</h4>
          {count > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Tout lire
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-white/40 text-sm p-4 text-center">
              Aucune notification
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 border-b border-white/5 hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">
                      {n.titre}
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      {n.message?.slice(0, 100)}
                    </div>
                    <div className="text-[10px] text-white/30 mt-1">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 whitespace-nowrap mt-1"
                  >
                    Lu
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
