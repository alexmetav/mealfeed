import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Home, Compass, PlusSquare, MessageSquare, Bookmark, User, Activity, CreditCard, Settings, Shield, LogOut, Sun, Moon, Trophy, Utensils, Menu, X, Bell } from 'lucide-react';
import clsx from 'clsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function DashboardLayout() {
  const { user, profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), where('read', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.docs.length);
    }, (error) => {
      console.error('Notifications count error:', error);
    });
    return () => unsub();
  }, [user]);

  const navItems = [
    { name: 'Home Feed', path: '/dashboard', icon: Home },
    { name: 'Explore', path: '/dashboard/explore', icon: Compass },
    { name: 'Upload Food', path: '/dashboard/upload', icon: PlusSquare },
    { name: 'Notifications', path: '/dashboard/notifications', icon: Bell, badge: unreadCount },
    { name: 'Meal Recommendations', path: '/dashboard/recommendations', icon: Utensils, isComingSoon: true },
    { name: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
    { name: 'Saved Posts', path: '/dashboard/saved', icon: Bookmark },
    { name: 'Profile', path: '/dashboard/profile', icon: User },
    { name: 'Rewards & TGE', path: '/dashboard/rewards', icon: Trophy, isHighlighted: true },
    { name: 'Health Score', path: '/dashboard/health', icon: Activity },
    { name: 'Health Assistant', path: '/dashboard/ai-assistant', icon: Activity },
    { name: 'Subscription', path: '/dashboard/subscription', icon: CreditCard },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ name: 'Admin Panel', path: '/dashboard/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 flex font-sans selection:bg-yellow-500/30">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "w-64 border-r border-zinc-200 dark:border-white/10 flex flex-col fixed h-full bg-zinc-50 dark:bg-[#0a0a0a] z-50 transition-transform duration-300 ease-in-out md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <Link to="/dashboard" className="text-2xl font-semibold tracking-tighter text-zinc-900 dark:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            MealFeed<span className="text-yellow-500">.</span>
          </Link>
          <button 
            className="md:hidden p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors" 
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            if (item.isComingSoon) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-4 py-3 rounded-2xl text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" strokeWidth={2} />
                    {item.name}
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-zinc-200 dark:bg-white/10 rounded-full">Soon</span>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300',
                  isActive 
                    ? 'bg-yellow-600 text-white font-medium shadow-md shadow-yellow-900/20' 
                    : item.isHighlighted
                      ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 font-semibold hover:bg-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5'
                )}
              >
                <item.icon className={clsx("w-5 h-5", isActive ? "text-white" : item.isHighlighted ? "text-yellow-500 animate-pulse" : "text-zinc-500")} strokeWidth={isActive || item.isHighlighted ? 2.5 : 2} />
                {item.name}
                {item.badge ? (
                  <span className="ml-auto flex items-center justify-center h-5 w-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : item.isHighlighted && !isActive && (
                  <span className="ml-auto flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#0a0a0a]">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-zinc-500 dark:text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all duration-300"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen bg-zinc-50 dark:bg-black w-full overflow-x-hidden">
        {/* Topbar */}
        <header className="h-20 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-4 md:px-8 sticky top-0 bg-zinc-50/80 dark:bg-black/80 backdrop-blur-2xl z-30">
          <div className="flex items-center gap-3 md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="p-2 -ml-2 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link to="/dashboard" className="text-xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
              MealFeed<span className="text-yellow-500">.</span>
            </Link>
          </div>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search foods, users..." 
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-5 ml-auto">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-yellow-500 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{profile?.username}</p>
                <p className="text-xs text-yellow-400 font-medium capitalize">{profile?.subscriptionPlan} Plan</p>
              </div>
              <img 
                src={profile?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
                alt="Profile" 
                className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-zinc-200 dark:border-white/10 shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
