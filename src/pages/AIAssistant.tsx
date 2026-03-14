import { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Bot, Sparkles, Loader2, Send, User as UserIcon, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';

const FAQS = [
  "Analyze my recent meals and give me a weekly summary.",
  "What are some high-protein vegetarian meals?",
  "How can I improve my daily health score?",
  "What's a good post-workout snack?",
];

export default function AIAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user || (profile?.subscriptionPlan === 'free' && profile?.role !== 'admin')) {
      setInitializing(false);
      return;
    }

    const initChat = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => doc.data());
        
        let mealContext = "The user hasn't logged any meals recently.";
        if (history.length > 0) {
          mealContext = "Here are the user's recent meals:\n" + history.map(h => `- ${h.foodType} (${h.healthRating} health rating, ${h.healthScore}/100 score)`).join('\n');
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: `You are a helpful nutrition and health assistant for the MealFeed app. Provide concise, accurate, and encouraging advice. ${mealContext}`,
          },
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      } finally {
        setInitializing(false);
      }
    };

    initChat();
  }, [user, profile]);

  if (profile?.subscriptionPlan === 'free' && profile?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-8 font-sans">
        <div className="w-24 h-24 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-orange-500/20 border border-orange-500/20">
          <Sparkles className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">AI Health Assistant</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed">
          Upgrade to AI Pro to unlock personalized health insights, weekly reports, and advanced diet recommendations based on your eating habits.
        </p>
        <button className="px-10 py-4 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-500 transition-all duration-300 shadow-lg shadow-orange-900/30 text-lg">
          Upgrade to AI Pro
        </button>
      </div>
    );
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || !chatRef.current) return;
    
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error communicating with the AI. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col font-sans">
      <div className="flex items-center gap-5 mb-6 shrink-0">
        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-purple-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Bot className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">Your AI Nutritionist</h1>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 flex flex-col overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        {initializing ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8">
                  <div className="w-20 h-20 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center mb-2">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-3">How can I help you today?</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Ask me anything about your diet, nutrition, or request an analysis of your recent meals.</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl p-5 ${
                      msg.role === 'user' 
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20 rounded-tr-sm' 
                        : 'bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 rounded-tl-sm'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div className="prose dark:prose-invert prose-orange max-w-none prose-p:leading-relaxed prose-sm">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 shadow-md">
                        <UserIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl rounded-tl-sm p-5 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <span className="text-sm text-zinc-500 font-medium">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-black/20 shrink-0 z-10 flex flex-col gap-3">
              <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
                {FAQS.map((faq, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(faq)}
                    disabled={loading}
                    className="whitespace-nowrap px-4 py-2 rounded-full bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all text-xs font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                  >
                    {faq}
                  </button>
                ))}
              </div>
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your diet, nutrition, or health score..."
                  className="w-full bg-white dark:bg-[#1c1c1e] border border-zinc-300 dark:border-white/20 rounded-full pl-6 pr-14 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all shadow-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-2 p-2.5 bg-orange-600 text-white rounded-full hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600 transition-colors shadow-md"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
