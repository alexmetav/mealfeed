import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Wallet, ArrowRight, Github, Chrome, AlertCircle, CheckCircle2, Loader2, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';

export default function Auth() {
  const navigate = useNavigate();
  const { login, loginWithEmail, registerWithEmail, loginWithWallet } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate('/dashboard');
      } else {
        if (!username || !name || !bio) {
          throw new Error('Please fill in all fields');
        }
        await registerWithEmail(email, password, username, name, gender, bio);
        setSuccess('Account created successfully! Logging you in...');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithWallet();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center p-6 font-sans">
      <div className="absolute top-8 left-8">
        <Link to="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Back to Home</span>
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white mb-2">
            MealFeed<span className="text-yellow-500">.</span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {mode === 'login' ? 'Welcome back to the global table' : 'Join the world\'s nutrition network'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] p-8 shadow-2xl border border-zinc-200 dark:border-white/10">
          <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-2xl mb-8 border border-zinc-200 dark:border-white/10">
            <button 
              onClick={() => setMode('login')}
              className={clsx(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                mode === 'login' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Login
            </button>
            <button 
              onClick={() => setMode('register')}
              className={clsx(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                mode === 'register' ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div 
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all"
                      required
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">@</div>
                    <input 
                      type="text" 
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={clsx(
                        "py-3 rounded-2xl text-sm font-bold border transition-all",
                        gender === 'male' 
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white" 
                          : "bg-zinc-50 dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10"
                      )}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={clsx(
                        "py-3 rounded-2xl text-sm font-bold border transition-all",
                        gender === 'female' 
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white" 
                          : "bg-zinc-50 dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10"
                      )}
                    >
                      Female
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('other')}
                      className={clsx(
                        "py-3 rounded-2xl text-sm font-bold border transition-all",
                        gender === 'other' 
                          ? "bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white" 
                          : "bg-zinc-50 dark:bg-white/5 text-zinc-500 border-zinc-200 dark:border-white/10"
                      )}
                    >
                      Other
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 focus:border-zinc-900 dark:focus:border-white focus:ring-0 transition-all text-sm resize-none h-24"
                      required
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="email" 
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="password" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all"
                required
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-sm font-medium"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {success}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-tighter hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? 'Login' : 'Create Account')}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
              <span className="bg-white dark:bg-[#1c1c1e] px-4 text-zinc-400">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={login}
              className="flex items-center justify-center gap-3 py-3.5 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl font-bold text-sm hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
            >
              <Chrome className="w-5 h-5 text-red-500" />
              Google
            </button>
            <button 
              onClick={handleWalletLogin}
              className="flex items-center justify-center gap-3 py-3.5 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl font-bold text-sm hover:bg-zinc-100 dark:hover:bg-white/10 transition-all"
            >
              <Wallet className="w-5 h-5 text-yellow-500" />
              Wallet
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
