import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Camera, Activity, Globe, Heart, ArrowRight, Smartphone, Apple, Zap, Brain, Sparkles, Utensils, Leaf } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

export default function Landing() {
  const { user, login } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans selection:bg-yellow-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-zinc-50 dark:bg-black/50 backdrop-blur-2xl border-b border-zinc-200 dark:border-white/10">
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="text-2xl font-semibold tracking-tighter text-zinc-900 dark:text-white">MealFeed<span className="text-yellow-500">.</span></div>
          <div className="flex gap-4">
            <button onClick={login} className="px-5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:text-white transition-colors">
              Log In
            </button>
            <button onClick={login} className="px-5 py-2 text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-black rounded-full hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm">
              Join Now
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-6 max-w-7xl mx-auto text-center overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none z-0 flex justify-center overflow-hidden">
          <div className="w-full max-w-7xl relative h-full">
            <motion.div 
              animate={{ y: [0, -15, 0], x: [0, 10, 0], rotate: [-4, 4, -4] }} 
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-20 md:top-32 left-[-20px] md:left-8 lg:left-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 hidden md:flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Utensils className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Avocado Toast</p>
                <p className="text-xs text-zinc-500">Healthy Fat</p>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 20, 0], x: [0, -10, 0], rotate: [4, -4, 4] }} 
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute top-40 md:top-48 right-[-20px] md:right-8 lg:right-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 hidden md:flex items-center gap-3"
            >
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Health Score</p>
                <p className="text-xs text-emerald-500 font-medium">Excellent</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">98</span>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, -12, 0], x: [0, 15, 0], rotate: [-5, 0, -5] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute bottom-20 md:bottom-28 left-10 md:left-24 lg:left-32 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md p-3 rounded-full shadow-2xl border border-zinc-200 dark:border-white/10 hidden md:flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-500/20 rounded-full flex items-center justify-center">
                <Leaf className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-sm font-bold pr-2 text-zinc-900 dark:text-white">Vegan Vibe</span>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 15, 0], x: [0, -15, 0], rotate: [5, -2, 5] }} 
              transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 3 }}
              className="absolute bottom-32 md:bottom-40 right-10 md:right-24 lg:right-32 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md p-3 rounded-full shadow-2xl border border-zinc-200 dark:border-white/10 hidden md:flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-sm font-bold pr-2 text-zinc-900 dark:text-white">High Protein</span>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-zinc-900 to-zinc-500 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            See What The World <br className="hidden md:block" /> Is Eating.
          </h1>
          <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-12 font-medium tracking-tight">
            Share your meals, discover global food trends, and receive health insights instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={login} className="flex items-center justify-center gap-2 px-8 py-4 bg-yellow-600 text-white rounded-full font-semibold hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-900/20 w-full sm:w-auto text-lg">
              Join Now <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-full font-semibold hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors w-full sm:w-auto text-lg backdrop-blur-md">
              Explore Feed
            </button>
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6 bg-zinc-100/50 dark:bg-[#1c1c1e]/50 border-y border-zinc-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-20 tracking-tight">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Upload Photo', desc: 'Snap a picture of your meal', icon: Camera },
              { step: '2', title: 'AI Detection', desc: 'Our neural networks identify ingredients instantly', icon: Brain },
              { step: '3', title: 'Global Trends', desc: 'See what the world is eating in real-time', icon: Globe },
              { step: '4', title: 'AI Insights', desc: 'Get personalized AI-driven nutrition tips', icon: Sparkles },
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="p-8 rounded-[2rem] bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors backdrop-blur-xl"
              >
                <div className="w-14 h-14 bg-yellow-500/20 text-yellow-400 rounded-2xl flex items-center justify-center mb-8 shadow-inner shadow-yellow-500/20">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold mb-3 tracking-tight">Step {item.step}: {item.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Narrative Section */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-4 h-4" /> Powered by Advanced AI
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-8 leading-tight">
              The AI Health Engine. <br />
              <span className="text-zinc-400">Precision at your fingertips.</span>
            </h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 mb-10 leading-relaxed">
              Our proprietary AI models don't just see food—they understand nutrition. From identifying hidden ingredients to calculating precise portion sizes, MealFeed gives you the data you need to live better.
            </p>
            
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-white/10">
                  <Activity className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 tracking-tight">Dynamic Health Score</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">Every meal is rated from 0-100 based on its nutritional density, macro balance, and processing level.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 shrink-0 bg-zinc-100 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-white/10">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 tracking-tight">AI Health Assistant</h3>
                  <p className="text-zinc-500 dark:text-zinc-400">A personalized coach that learns your habits and provides tailored advice to help you reach your goals faster.</p>
                </div>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="aspect-square bg-gradient-to-br from-yellow-500/20 to-purple-500/20 rounded-[3rem] p-8 border border-yellow-500/20 shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/nutrition/800/800')] bg-cover bg-center opacity-40 group-hover:scale-110 transition-transform duration-700" />
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="bg-white/10 backdrop-blur-2xl p-6 rounded-3xl border border-white/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold uppercase tracking-widest opacity-70">AI Analysis</span>
                    <span className="px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full">92/100</span>
                  </div>
                  <p className="text-lg font-semibold mb-2">Mediterranean Quinoa Bowl</p>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md">High Protein</span>
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md">Fiber Rich</span>
                    <span className="text-[10px] px-2 py-1 bg-white/10 rounded-md">Low GI</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/30 blur-[60px] rounded-full" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/30 blur-[60px] rounded-full" />
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-32 px-6 max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6 tracking-tight">Choose Your Plan</h2>
        
        <div className="flex justify-center mb-16">
          <div className="flex items-center bg-zinc-200 dark:bg-white/5 p-1 rounded-full border border-zinc-300 dark:border-white/10 w-fit">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={clsx(
                "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                billingCycle === 'monthly' ? "bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={clsx(
                "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                billingCycle === 'yearly' ? "bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Yearly <span className="text-[10px] text-yellow-500 uppercase tracking-wider ml-1">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { name: 'Free', priceMonthly: '$0', priceYearly: '$0', features: ['Upload food photos', 'Browse feed', 'Like & comment', 'Save posts'] },
            { name: 'Premium', priceMonthly: '$49', priceYearly: '$499', features: ['Profile customization', 'Premium glowing badge', 'Direct DM inbox', 'Basic health score'], popular: true },
            { name: 'Pro', priceMonthly: '$99', priceYearly: '$799', features: ['Health assistant', 'Weekly health reports', 'Advanced health insights', 'Personalized diet recommendations'] },
          ].map((plan, i) => (
            <div key={i} className={clsx(
              "p-10 rounded-[2.5rem] border flex flex-col transition-transform duration-300 hover:scale-[1.02]",
              plan.popular ? "bg-white dark:bg-[#1c1c1e] border-yellow-500/50 shadow-2xl shadow-yellow-900/20 relative" : "bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 backdrop-blur-xl"
            )}>
              {plan.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-yellow-500 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg shadow-yellow-500/20">Most Popular</span>}
              <h3 className="text-2xl font-semibold mb-2 tracking-tight">{plan.name}</h3>
              <div className="text-5xl font-bold mb-8 tracking-tighter">
                {billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly}
                <span className="text-xl text-zinc-500 font-medium tracking-normal">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-4 text-zinc-600 dark:text-zinc-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                    <span className="font-medium text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={login} className={clsx(
                "w-full py-4 rounded-2xl font-semibold transition-all duration-300",
                plan.popular ? "bg-yellow-600 text-white hover:bg-yellow-500 shadow-lg shadow-yellow-900/30" : "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-white/20"
              )}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* App Download Section */}
      <section className="py-32 px-6 bg-zinc-900 dark:bg-zinc-900 text-white rounded-[3rem] mx-6 mb-24 overflow-hidden relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="md:w-1/2 text-center md:text-left">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">MealFeed in your pocket.</h2>
            <p className="text-xl text-zinc-400 mb-10 max-w-lg">
              Get the full experience on the go. Track meals, connect with friends, and stay healthy wherever you are.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="flex items-center gap-3 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl backdrop-blur-md opacity-60 cursor-not-allowed">
                <Apple className="w-6 h-6" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Coming Soon on</p>
                  <p className="text-lg font-bold leading-none">App Store</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl backdrop-blur-md opacity-60 cursor-not-allowed">
                <Smartphone className="w-6 h-6" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Coming Soon on</p>
                  <p className="text-lg font-bold leading-none">Google Play</p>
                </div>
              </div>
            </div>
          </div>
          <div className="md:w-1/2 relative">
            <div className="relative z-10 bg-zinc-800 rounded-[3rem] p-4 border border-white/10 shadow-2xl transform rotate-6 hover:rotate-0 transition-transform duration-500">
               <img 
                src="https://picsum.photos/seed/app/600/1200" 
                alt="App Preview" 
                className="rounded-[2.5rem] w-full max-w-[300px] mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Decorative blobs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-yellow-500/20 blur-[120px] rounded-full -z-10" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-2xl font-semibold tracking-tighter text-zinc-900 dark:text-white">MealFeed<span className="text-yellow-500">.</span></div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">© 2026 MealFeed. All rights reserved.</p>
          <div className="flex gap-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
