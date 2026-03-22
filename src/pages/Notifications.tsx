import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Heart, MessageCircle, UserPlus, CheckCircle2, Bell, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface Notification {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  actorImage: string;
  type: 'like' | 'comment' | 'follow' | 'message' | 'admin_message';
  postId?: string;
  message?: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto font-sans pb-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-zinc-100 dark:bg-white/5 rounded-3xl border border-zinc-200 dark:border-white/10">
          <Bell className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-1">No notifications yet</h3>
          <p className="text-zinc-500 dark:text-zinc-400">When someone interacts with you, it will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              onClick={() => !notification.read && markAsRead(notification.id)}
              className={clsx(
                "flex items-start gap-4 p-4 rounded-2xl border transition-colors cursor-pointer",
                notification.read 
                  ? "bg-white dark:bg-[#0a0a0a] border-zinc-200 dark:border-white/10" 
                  : "bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-200 dark:border-yellow-500/20"
              )}
            >
              <Link to={`/dashboard/user/${notification.actorId}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={notification.actorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.actorId}`} 
                  alt={notification.actorName} 
                  className="w-12 h-12 rounded-full border border-zinc-200 dark:border-white/10"
                />
              </Link>
              
              <Link to={notification.link || (notification.postId ? `/dashboard/feed?post=${notification.postId}` : `/dashboard/user/${notification.actorId}`)} className="flex-1 min-w-0" onClick={() => !notification.read && markAsRead(notification.id)}>
                <p className="text-sm text-zinc-900 dark:text-white">
                  <span className="font-semibold hover:underline">
                    {notification.actorName}
                  </span>
                  {' '}
                  {notification.type === 'like' && 'liked your post.'}
                  {notification.type === 'comment' && 'commented on your post.'}
                  {notification.type === 'follow' && 'started following you.'}
                  {notification.type === 'message' && 'sent you a message.'}
                  {notification.type === 'admin_message' && (
                    <>
                      sent you an official message: <span className="italic text-zinc-600 dark:text-zinc-400">"{notification.message}"</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {new Date(notification.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </Link>

              <div className="shrink-0">
                {notification.type === 'like' && <Heart className="w-5 h-5 text-red-500 fill-red-500" />}
                {notification.type === 'comment' && <MessageCircle className="w-5 h-5 text-blue-500 fill-blue-500" />}
                {notification.type === 'follow' && <UserPlus className="w-5 h-5 text-emerald-500" />}
                {notification.type === 'message' && <MessageSquare className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                {notification.type === 'admin_message' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
