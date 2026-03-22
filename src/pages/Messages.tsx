import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock, Send, Loader2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import clsx from 'clsx';

interface ChatUser {
  id: string;
  name: string;
  image: string;
}

interface Chat {
  id: string;
  users: string[];
  lastMessage: string;
  lastMessageTime: any;
  userDetails: Record<string, ChatUser>;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export default function Messages() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toUserId = searchParams.get('to');

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user || (profile?.subscriptionPlan === 'free' && profile?.role !== 'admin')) {
      setLoadingChats(false);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', user.uid),
      orderBy('lastMessageTime', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedChats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
      setChats(fetchedChats);
      setLoadingChats(false);

      if (toUserId) {
        const existingChat = fetchedChats.find(c => c.users.includes(toUserId));
        if (existingChat) {
          setActiveChat(existingChat);
        } else {
          // Need to create a new chat when sending the first message
          getDoc(doc(db, 'users', toUserId)).then(targetUserDoc => {
            if (targetUserDoc.exists()) {
              const targetData = targetUserDoc.data();
              const newChatId = [user.uid, toUserId].sort().join('_');
              setActiveChat({
                id: newChatId,
                users: [user.uid, toUserId],
                lastMessage: '',
                lastMessageTime: null,
                userDetails: {
                  [user.uid]: { id: user.uid, name: profile?.username || 'User', image: profile?.profileImage || '' },
                  [toUserId]: { id: toUserId, name: targetData.username || 'User', image: targetData.profileImage || '' }
                }
              });
            }
          });
        }
      } else if (!activeChat && fetchedChats.length > 0) {
        setActiveChat(fetchedChats[0]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
      setLoadingChats(false);
    });

    return () => unsub();
  }, [user, profile, toUserId]);

  useEffect(() => {
    if (!activeChat || !activeChat.id) return;

    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`);
    });

    return () => unsub();
  }, [activeChat?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim()) return;

    setSending(true);
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          users: activeChat.users,
          userDetails: activeChat.userDetails,
          lastMessage: newMessage,
          lastMessageTime: serverTimestamp()
        });
      } else {
        await setDoc(chatRef, {
          lastMessage: newMessage,
          lastMessageTime: serverTimestamp()
        }, { merge: true });
      }

      await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
        senderId: user.uid,
        text: newMessage,
        createdAt: serverTimestamp()
      });

      // Create a notification for the recipient
      const recipientId = activeChat.users.find(id => id !== user.uid);
      if (recipientId) {
        await addDoc(collection(db, 'notifications'), {
          userId: recipientId,
          actorId: user.uid,
          actorName: profile?.username || 'User',
          actorImage: profile?.profileImage || '',
          type: 'message',
          read: false,
          createdAt: new Date().toISOString(),
          link: `/dashboard/messages?to=${user.uid}`
        });
      }

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chats/messages');
    } finally {
      setSending(false);
    }
  };

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
        <button 
          onClick={() => navigate('/dashboard/subscription')}
          className="px-10 py-4 bg-yellow-600 text-white font-semibold rounded-full hover:bg-yellow-500 transition-all duration-300 shadow-lg shadow-yellow-900/30 text-lg"
        >
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
          {loadingChats ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
          ) : chats.length === 0 && !toUserId ? (
            <p className="text-center text-zinc-500 dark:text-zinc-400 py-8 text-sm">No messages yet.</p>
          ) : (
            <>
              {activeChat && !chats.find(c => c.id === activeChat.id) && (
                <div className="p-4 rounded-2xl bg-zinc-200 dark:bg-white/10 cursor-pointer flex items-center gap-4 transition-colors group">
                  <img 
                    src={activeChat.userDetails[toUserId!]?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${toUserId}`} 
                    alt="User" 
                    className="w-12 h-12 rounded-full border border-zinc-200 dark:border-white/10 flex-shrink-0" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-white truncate">{activeChat.userDetails[toUserId!]?.name || 'User'}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">New conversation</p>
                  </div>
                </div>
              )}
              {chats.map(chat => {
                const otherUserId = chat.users.find(id => id !== user?.uid) || chat.users[0];
                const otherUser = chat.userDetails[otherUserId];
                const isActive = activeChat?.id === chat.id;
                
                return (
                  <div 
                    key={chat.id}
                    onClick={() => { setActiveChat(chat); navigate('/dashboard/messages'); }}
                    className={clsx(
                      "p-4 rounded-2xl cursor-pointer flex items-center gap-4 transition-colors group",
                      isActive ? "bg-zinc-200 dark:bg-white/10" : "hover:bg-zinc-100 dark:hover:bg-white/5"
                    )}
                  >
                    <img 
                      src={otherUser?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`} 
                      alt={otherUser?.name} 
                      className="w-12 h-12 rounded-full border border-zinc-200 dark:border-white/10 flex-shrink-0 bg-zinc-100 dark:bg-[#1c1c1e]" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-zinc-900 dark:text-white truncate">{otherUser?.name || 'User'}</p>
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate group-hover:text-zinc-600 dark:text-zinc-300 transition-colors">
                        {chat.lastMessage || 'Start a conversation'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-50 dark:from-[#1c1c1e] to-zinc-100 dark:to-black/50 relative">
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-6 shadow-inner shadow-white/5">
              <MessageSquare className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">Select a conversation to start messaging</p>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-center gap-4 bg-white/50 dark:bg-black/20 backdrop-blur-md sticky top-0 z-10">
              <img 
                src={activeChat.userDetails[activeChat.users.find(id => id !== user?.uid) || activeChat.users[0]]?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.users.find(id => id !== user?.uid)}`} 
                alt="User" 
                className="w-10 h-10 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#1c1c1e]" 
              />
              <h2 className="font-semibold text-lg tracking-tight text-zinc-900 dark:text-white">
                {activeChat.userDetails[activeChat.users.find(id => id !== user?.uid) || activeChat.users[0]]?.name || 'User'}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
                    <div className={clsx(
                      "max-w-[70%] rounded-2xl p-4",
                      isMe 
                        ? "bg-yellow-600 text-white rounded-tr-sm shadow-lg shadow-yellow-900/20" 
                        : "bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-100 rounded-tl-sm shadow-sm"
                    )}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md shrink-0">
              <form onSubmit={handleSendMessage} className="relative flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-white dark:bg-[#1c1c1e] border border-zinc-300 dark:border-white/20 rounded-full pl-6 pr-14 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-transparent transition-all shadow-sm"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="absolute right-2 p-2.5 bg-yellow-600 text-white rounded-full hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-yellow-600 transition-colors shadow-md"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
