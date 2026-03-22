import { X } from 'lucide-react';
import PostCard from './PostCard';

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

interface PostModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  isFollowing?: boolean;
  isLiked?: boolean;
  onFollow?: (userId: string, authorName: string, authorImage?: string) => void;
  onLike?: (postId: string, authorId: string) => void;
  onDelete?: (postId: string) => void;
  onSaveCaption?: (postId: string, newCaption: string) => void;
  onRescan?: (post: Post) => void;
  onOpenComments?: (postId: string, authorId: string) => void;
  rescanningId?: string | null;
}

export default function PostModal({
  post,
  isOpen,
  onClose,
  currentUserId,
  isFollowing,
  isLiked,
  onFollow,
  onLike,
  onDelete,
  onSaveCaption,
  onRescan,
  onOpenComments,
  rescanningId
}: PostModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="max-w-xl w-full relative" onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-zinc-500 hover:text-zinc-900 dark:text-white transition-colors bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 p-2 rounded-full shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>
        <PostCard
          post={post}
          currentUserId={currentUserId}
          isFollowing={isFollowing}
          isLiked={isLiked}
          onFollow={onFollow}
          onLike={onLike}
          onDelete={(postId) => {
            if (onDelete) onDelete(postId);
            onClose();
          }}
          onSaveCaption={onSaveCaption}
          onRescan={onRescan}
          onOpenComments={onOpenComments}
          rescanningId={rescanningId}
        />
      </div>
    </div>
  );
}
