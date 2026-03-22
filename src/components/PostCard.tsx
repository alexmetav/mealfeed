import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Bookmark, MoreVertical, Trash2, Edit2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import LoadingSpinner from './LoadingSpinner';

interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorImage?: string;
  imageUrl: string;
  foodType: string;
  category: string;
  healthRating: string;
  healthScore: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorIsCreator?: boolean;
}

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  isFollowing?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  onFollow?: (userId: string, authorName: string, authorImage?: string) => void;
  onLike?: (postId: string, authorId: string) => void;
  onDelete?: (postId: string) => void;
  onSaveCaption?: (postId: string, newCaption: string) => void;
  onSave?: (postId: string) => void;
  onRescan?: (post: Post) => void;
  onOpenComments?: (postId: string, authorId: string) => void;
  rescanningId?: string | null;
}

export default function PostCard({
  post,
  currentUserId,
  isFollowing,
  isLiked,
  isSaved,
  onFollow,
  onLike,
  onDelete,
  onSaveCaption,
  onSave,
  onRescan,
  onOpenComments,
  rescanningId
}: PostCardProps) {
  const [activeMenu, setActiveMenu] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaptionText, setEditCaptionText] = useState(post.caption || '');

  const handleSaveCaption = () => {
    if (onSaveCaption) {
      onSaveCaption(post.id, editCaptionText);
      setIsEditingCaption(false);
    }
  };

  return (
    <article className="bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/50 transition-transform duration-300 hover:scale-[1.01]">
      {/* Header */}
      <div className="p-5 flex items-center justify-between relative">
        <div className="flex items-center gap-4">
          <Link to={`/dashboard/user/${post.userId}`}>
            <img 
               src={post.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.userId}`} 
              alt={post.authorName} 
              className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link to={`/dashboard/user/${post.userId}`}>
                <span className="font-semibold text-zinc-900 dark:text-white tracking-tight cursor-pointer hover:text-yellow-500 transition-colors">{post.authorName}</span>
              </Link>
              {post.authorIsCreator && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-blue-500/20">Creator</span>
              )}
              {post.userId !== currentUserId && onFollow && (
                <button 
                  onClick={() => onFollow(post.userId, post.authorName, post.authorImage)}
                  className={clsx("text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors uppercase tracking-wider", isFollowing ? "bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-white" : "bg-yellow-500 text-white")}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
              {/* Premium Badge Mock */}
              {post.healthScore > 80 && (
                <span className="text-[10px] px-2 py-0.5 bg-yellow-500 text-white font-bold rounded-full uppercase tracking-wider shadow-sm shadow-yellow-500/20">Pro</span>
              )}
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        
        {/* Options Menu */}
        {post.userId === currentUserId && (
          <div className="relative">
            <button 
              onClick={() => setActiveMenu(!activeMenu)}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {activeMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#2c2c2e] border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl z-10 overflow-hidden">
                <button 
                  onClick={() => {
                    setIsEditingCaption(true);
                    setEditCaptionText(post.caption || '');
                    setActiveMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Edit Caption
                </button>
                <button 
                  onClick={() => {
                    if (onRescan) onRescan(post);
                    setActiveMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Rescan Image
                </button>
                <button 
                  onClick={() => {
                    if (onDelete) onDelete(post.id);
                    setActiveMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-zinc-50 dark:bg-black group">
        <img 
          src={post.imageUrl} 
          alt={post.foodType}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {rescanningId === post.id && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <LoadingSpinner />
            <span className="text-white font-medium mt-4">Rescanning...</span>
          </div>
        )}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <span className="px-4 py-2 bg-zinc-50 dark:bg-black/40 backdrop-blur-xl rounded-full text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 shadow-lg">
            {post.foodType}
          </span>
          <span className={clsx(
            "px-4 py-2 backdrop-blur-xl rounded-full text-xs font-bold border shadow-lg text-center",
            post.healthRating === 'High' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
            post.healthRating === 'Medium' ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
            "bg-red-500/20 text-red-400 border-red-500/30"
          )}>
            {post.healthRating} Health
          </span>
        </div>
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <div className="px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-lg shadow-emerald-900/40 border border-emerald-400/50 w-fit">
            Health Score: {post.healthScore}
          </div>
          
          {/* Nutritional Info Overlay */}
          {post.calories !== undefined && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                <span className="text-zinc-400 mr-1">Cal</span>{post.calories}
              </div>
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                <span className="text-zinc-400 mr-1">Pro</span>{post.protein}g
              </div>
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                <span className="text-zinc-400 mr-1">Carb</span>{post.carbs}g
              </div>
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-medium border border-white/10 shadow-lg">
                <span className="text-zinc-400 mr-1">Fat</span>{post.fat}g
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => onLike && onLike(post.id, post.userId)}
              className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-yellow-500 transition-colors group"
            >
              <Heart className={clsx("w-7 h-7 transition-transform group-hover:scale-110", isLiked && "fill-yellow-500 text-yellow-500")} />
            </button>
            <button 
              onClick={() => onOpenComments && onOpenComments(post.id, post.userId)}
              className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group"
            >
              <MessageCircle className="w-7 h-7 transition-transform group-hover:scale-110" />
            </button>
          </div>
          <button 
            onClick={() => onSave && onSave(post.id)}
            className={clsx("transition-colors group", isSaved ? "text-yellow-500" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white")}
          >
            <Bookmark className={clsx("w-7 h-7 transition-transform group-hover:scale-110", isSaved && "fill-yellow-500")} />
          </button>
        </div>

        <div className="font-semibold text-sm mb-2 text-zinc-900 dark:text-white">{post.likesCount} likes</div>
        
        <div className="text-sm leading-relaxed">
          <Link to={`/dashboard/user/${post.userId}`}>
            <span className="font-semibold mr-2 text-zinc-900 dark:text-white cursor-pointer hover:text-yellow-500 transition-colors">{post.authorName}</span>
          </Link>
          {isEditingCaption ? (
            <div className="mt-2 flex gap-2">
              <input 
                type="text"
                value={editCaptionText}
                onChange={(e) => setEditCaptionText(e.target.value)}
                className="flex-1 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                autoFocus
              />
              <button 
                onClick={handleSaveCaption}
                className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
              >
                Save
              </button>
              <button 
                onClick={() => setIsEditingCaption(false)}
                className="px-3 py-1.5 bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="text-zinc-600 dark:text-zinc-300">{post.caption}</span>
          )}
        </div>
        
        {post.commentsCount > 0 && (
          <button 
            onClick={() => onOpenComments && onOpenComments(post.id, post.userId)}
            className="text-zinc-500 text-sm mt-3 hover:text-zinc-500 dark:text-zinc-400 font-medium transition-colors"
          >
            View all {post.commentsCount} comments
          </button>
        )}
      </div>
    </article>
  );
}
