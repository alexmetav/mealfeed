import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock } from 'lucide-react';

export default function Messages() {
  const { profile } = useAuth();

  if (profile?.subscriptionPlan === 'free' && profile?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-8 font-sans">
        <div className="w-24 h-24 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-white/5">
          <Lock className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">Direct Messaging</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed">
          Direct messaging is a Premium feature. Upgrade your account to connect directly with other foodies!
        </p>
        <button className="px-10 py-4 bg-yellow-600 text-white font-semibold rounded-full hover:bg-yellow-500 transition-all duration-300 shadow-lg shadow-yellow-900/30 text-lg">
          Upgrade to Premium
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 font-sans">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-zinc-200 dark:border-white/10 flex flex-col bg-zinc-50 dark:bg-black/20">
        <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-xl tracking-tight text-zinc-900 dark:text-white">Messages</h2>
          <button className="p-2 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <MessageSquare className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="p-4 rounded-2xl hover:bg-zinc-100 dark:bg-white/5 cursor-pointer flex items-center gap-4 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-purple-500/20 border border-zinc-200 dark:border-white/10 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-zinc-900 dark:text-white truncate">Alex Chef</p>
                <span className="text-[10px] text-zinc-500 font-medium">2h</span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate group-hover:text-zinc-600 dark:text-zinc-300 transition-colors">That pizza looks amazing! 🍕</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-gradient-to-br from-zinc-50 dark:from-[#1c1c1e] to-zinc-100 dark:to-black/50">
        <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-6 shadow-inner shadow-white/5">
          <MessageSquare className="w-10 h-10 text-zinc-600" />
        </div>
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Select a conversation to start messaging</p>
      </div>
    </div>
  );
}
