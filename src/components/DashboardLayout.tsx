import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Home, Compass, PlusSquare, MessageSquare, Bookmark, User, Activity, CreditCard, Settings, Shield, LogOut, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardLayout() {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { name: 'Home Feed', path: '/dashboard', icon: Home },
    { name: 'Explore', path: '/dashboard/explore', icon: Compass },
    { name: 'Upload Food', path: '/dashboard/upload', icon: PlusSquare },
    { name: 'Messages', path: '/dashboard/messages', icon: MessageSquare },
    { name: 'Saved Posts', path: '/dashboard/saved', icon: Bookmark },
    { name: 'Profile', path: '/dashboard/profile', icon: User },
    { name: 'Health Score', path: '/dashboard/health', icon: Activity },
    { name: 'Health Assistant', path: '/dashboard/ai-assistant', icon: Activity },
    { name: 'Subscription', path: '/dashboard/subscription', icon: CreditCard },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  if (profile?.role === 'admin') {
    navItems.push({ name: 'Admin Panel', path: '/dashboard/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 flex font-sans selection:bg-orange-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-200 dark:border-white/10 flex flex-col hidden md:flex fixed h-full bg-zinc-50 dark:bg-black/50 backdrop-blur-xl z-20">
        <div className="p-8">
          <Link to="/dashboard" className="text-2xl font-semibold tracking-tighter text-zinc-900 dark:text-white">
            MealFeed<span className="text-orange-500">.</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300',
                  isActive 
                    ? 'bg-orange-600 text-white font-medium shadow-md shadow-orange-900/20' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/5'
                )}
              >
                <item.icon className={clsx("w-5 h-5", isActive ? "text-white" : "text-zinc-500")} strokeWidth={isActive ? 2.5 : 2} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-white/10">
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
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen bg-zinc-50 dark:bg-black">
        {/* Topbar */}
        <header className="h-20 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-8 sticky top-0 bg-zinc-50 dark:bg-black/70 backdrop-blur-2xl z-10">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search foods, users..." 
                className="w-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full px-5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-5 ml-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{profile?.username}</p>
                <p className="text-xs text-orange-400 font-medium capitalize">{profile?.subscriptionPlan} Plan</p>
              </div>
              <img 
                src={profile?.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.uid}`} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border border-zinc-200 dark:border-white/10 shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
