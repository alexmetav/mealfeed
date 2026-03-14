import { motion } from 'framer-motion';
import { UtensilsCrossed } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ 
          y: [0, -6, 0],
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative bg-white dark:bg-[#1c1c1e] p-4 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-xl mb-4"
      >
        <UtensilsCrossed className="w-6 h-6 text-yellow-400" />
      </motion.div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div 
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
            className="w-1.5 h-1.5 rounded-full bg-yellow-500"
          />
        ))}
      </div>
    </div>
  );
}
