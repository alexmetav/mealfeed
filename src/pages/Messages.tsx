import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Lock, Send, Loader2, RefreshCw } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, addDoc, getDoc, serverTimestamp, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
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
  status?: 'pending' | 'accepted';
  createdBy?: string;
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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [lastVisibleMessage, setLastVisibleMessage] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user) {
      setLoadingChats(false);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', user.uid),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedChats = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Chat))
        .sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis?.() || 0;
          const timeB = b.lastMessageTime?.toMillis?.() || 0;
          return timeB - timeA;
        });
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
                status: (profile?.subscriptionPlan === 'premium' || profile?.subscriptionPlan === 'pro' || profile?.role === 'admin') ? 'accepted' : 'pending',
                createdBy: user.uid,
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
    const isNewChat = activeChat?.lastMessageTime === null;
    if (!activeChat || !activeChat.id || isNewChat) {
      setMessages([]);
      setHasMoreMessages(false);
      setLastVisibleMessage(null);
      return;
    }

    setLoadingMessages(true);
    const pageSize = 50;
    const q = query(
      collection(db, `chats/${activeChat.id}/messages`),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const unsub = onSnapshot(q, (snap) => {
      const fetchedMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(fetchedMessages);
      setLastVisibleMessage(snap.docs[snap.docs.length - 1] || null);
      setHasMoreMessages(snap.docs.length === pageSize);
      setLoadingMessages(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`);
      setLoadingMessages(false);
    });

    return () => unsub();
  }, [activeChat?.id, activeChat?.lastMessageTime]);

  const loadMoreMessages = async () => {
    if (!activeChat || loadingMoreMessages || !hasMoreMessages || !lastVisibleMessage) return;
    setLoadingMoreMessages(true);
    
    try {
      const pageSize = 50;
      const q = query(
        collection(db, `chats/${activeChat.id}/messages`),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisibleMessage),
        limit(pageSize)
      );

      const snapshot = await getDocs(q);
      const fetchedMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      
      setMessages(prev => [...fetchedMessages, ...prev]);
      setLastVisibleMessage(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreMessages(snapshot.docs.length === pageSize);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim()) return;

    setSending(true);
    try {
      const chatRef = doc(db, 'chats', activeChat.id);
      const isNewChat = activeChat.lastMessageTime === null;
      const isPremium = profile?.subscriptionPlan === 'premium' || profile?.subscriptionPlan === 'pro' || profile?.role === 'admin';

      if (isNewChat) {
        await setDoc(chatRef, {
          users: activeChat.users,
          userDetails: activeChat.userDetails,
          lastMessage: newMessage,
          lastMessageTime: serverTimestamp(),
          status: isPremium ? 'accepted' : 'pending',
          createdBy: user.uid
        });
      } else {
        const chatDoc = await getDoc(chatRef);
        const chatData = chatDoc.data();
        const updates: any = {
          lastMessage: newMessage,
          lastMessageTime: serverTimestamp()
        };

        // If it was pending and a premium user sends a message, or if the recipient of the request replies
        if (chatData?.status === 'pending') {
          if (isPremium || chatData.createdBy !== user.uid) {
            updates.status = 'accepted';
          }
        }

        await setDoc(chatRef, updates, { merge: true });
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

  const inboxChats = chats.filter(c => c.status === 'accepted' || !c.status);
  const requestChats = chats.filter(c => c.status === 'pending');

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
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {loadingChats ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
          ) : (
            <>
              {/* Inbox Section */}
              {inboxChats.length > 0 && (
                <div className="space-y-1">
                  <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Inbox</p>
                  {inboxChats.map(chat => {
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
                </div>
              )}

              {/* Requests Section */}
              {requestChats.length > 0 && (
                <div className="space-y-1">
                  <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Requests</p>
                  {requestChats.map(chat => {
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
                        <div className="relative">
                          <img 
                            src={otherUser?.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`} 
                            alt={otherUser?.name} 
                            className="w-12 h-12 rounded-full border border-zinc-200 dark:border-white/10 flex-shrink-0 bg-zinc-100 dark:bg-[#1c1c1e]" 
                          />
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white dark:border-zinc-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-zinc-900 dark:text-white truncate">{otherUser?.name || 'User'}</p>
                          </div>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate group-hover:text-zinc-600 dark:text-zinc-300 transition-colors">
                            {chat.lastMessage || 'Message request'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {chats.length === 0 && !toUserId && (
                <p className="text-center text-zinc-500 dark:text-zinc-400 py-8 text-sm">No messages yet.</p>
              )}

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
            
            {activeChat.status === 'pending' && activeChat.createdBy !== user?.uid && (
              <div className="p-4 bg-yellow-500/10 border-b border-yellow-500/20 text-center">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  This is a message request. Replying will accept the request.
                </p>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {hasMoreMessages && (
                <div className="flex justify-center pb-4">
                  <button
                    onClick={loadMoreMessages}
                    disabled={loadingMoreMessages}
                    className="px-4 py-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400 rounded-full text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-2 border border-zinc-200 dark:border-white/10"
                  >
                    {loadingMoreMessages ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      'Load older messages'
                    )}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                </div>
              ) : (
                messages.map((msg) => {
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
                })
              )}
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
