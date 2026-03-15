import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { X, Send } from 'lucide-react';
import clsx from 'clsx';

interface Comment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface CommentsModalProps {
  postId: string;
  postAuthorId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentsModal({ postId, postAuthorId, isOpen, onClose }: CommentsModalProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
      setLoading(false);
    });

    return () => unsub();
  }, [postId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newComment.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const isNewDay = profile.lastActionDate !== today;
    const currentComments = isNewDay ? 0 : (profile.dailyCommentsCount || 0);

    if (currentComments >= 10) {
      alert('Daily comment limit (10) reached!');
      return;
    }

    const commentId = `${user.uid}_${Date.now()}`;
    const commentRef = doc(db, 'comments', commentId);
    const postRef = doc(db, 'posts', postId);
    const userRef = doc(db, 'users', user.uid);
    const authorRef = doc(db, 'users', postAuthorId);

    try {
      await setDoc(commentRef, {
        postId,
        userId: user.uid,
        authorName: profile.username,
        text: newComment,
        createdAt: new Date().toISOString()
      });

      await updateDoc(postRef, { commentsCount: increment(1) });

      // Update points and counts
      const pointsToEarn = profile.isCreator ? 1000 : 500;
      await updateDoc(userRef, {
        points: increment(pointsToEarn),
        dailyCommentsCount: isNewDay ? 1 : increment(1),
        lastActionDate: today
      });

      // Reward author if it's not the same user
      if (postAuthorId !== user.uid) {
        await updateDoc(authorRef, {
          points: increment(500)
        });
        
        // Create notification
        const notificationId = `${user.uid}_comment_${postId}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notificationId), {
          userId: postAuthorId,
          actorId: user.uid,
          actorName: profile.username,
          actorImage: profile.profileImage || '',
          type: 'comment',
          postId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `comments/${commentId}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-white/10">
          <h3 className="font-semibold text-zinc-900 dark:text-white">Comments</h3>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} alt={comment.authorName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="bg-zinc-100 dark:bg-white/5 rounded-2xl rounded-tl-none px-4 py-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white mr-2">{comment.authorName}</span>
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">{comment.text}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 ml-2">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input */}
        <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#0a0a0a]">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="p-2 rounded-full bg-yellow-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
