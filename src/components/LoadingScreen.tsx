import { motion } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center"
      >
        <div className="absolute inset-0 bg-orange-500/20 blur-[40px] rounded-full" />
        <motion.div
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative bg-gradient-to-br from-[#242426] to-[#1c1c1e] p-6 rounded-[2rem] border border-zinc-200 dark:border-white/10 shadow-2xl mb-8"
        >
          <UtensilsCrossed className="w-10 h-10 text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
        </motion.div>
        
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight">Curating your taste...</h2>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div 
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }} 
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
