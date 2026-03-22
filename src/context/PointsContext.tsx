import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface PointsEvent {
  id: string;
  amount: number;
  label: string;
}

interface PointsContextType {
  showPoints: (amount: number, label: string) => void;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const usePoints = () => {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error('usePoints must be used within a PointsProvider');
  }
  return context;
};

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<PointsEvent[]>([]);

  const showPoints = useCallback((amount: number, label: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setEvents((prev) => [...prev, { id, amount, label }]);
    
    // Auto-remove after animation
    setTimeout(() => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }, 2500);
  }, []);

  return (
    <PointsContext.Provider value={{ showPoints }}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
        <AnimatePresence>
          {events.map((event) => (
            <PointsPop key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>
    </PointsContext.Provider>
  );
};

const PointsPop = ({ event }: { event: PointsEvent }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ 
        opacity: [0, 1, 1, 0], 
        scale: [0.5, 1.2, 1, 0.8],
        y: [20, -100, -150, -200],
      }}
      transition={{ duration: 2, ease: "easeOut" }}
      className="absolute flex flex-col items-center gap-1"
    >
      <div className="flex items-center gap-2 bg-yellow-500 text-white px-6 py-3 rounded-full shadow-2xl shadow-yellow-500/40 border-2 border-white/20">
        <Sparkles className="w-5 h-5 fill-current" />
        <span className="text-2xl font-black tracking-tighter">+{event.amount.toLocaleString()}</span>
      </div>
      <motion.span 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-yellow-600 dark:text-yellow-400 font-bold text-sm uppercase tracking-widest bg-white/80 dark:bg-black/80 px-3 py-1 rounded-lg backdrop-blur-sm"
      >
        {event.label}
      </motion.span>
      
      {/* Particle effects */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ 
            x: (Math.random() - 0.5) * 200, 
            y: (Math.random() - 0.5) * 200,
            opacity: 0,
            scale: 0
          }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute w-2 h-2 bg-yellow-400 rounded-full"
        />
      ))}
    </motion.div>
  );
};
