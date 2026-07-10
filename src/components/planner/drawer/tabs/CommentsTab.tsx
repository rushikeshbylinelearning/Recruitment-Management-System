import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import { useAuth } from '../../../../contexts/AuthContext';

interface Comment {
  id: number;
  user_id: number;
  comment_text: string;
  author_name: string;
  created_at: string;
  parent_comment_id?: number | null;
}

interface CommentsTabProps {
  taskId: number;
}

export default function CommentsTab({ taskId }: CommentsTabProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    const data = await plannerService.getComments(taskId);
    setComments(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchComments(); }, [taskId]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await plannerService.addComment(taskId, text.trim());
      setText('');
      fetchComments();
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-gray-200 dark:bg-neutral-700 rounded" />)}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-neutral-500">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {c.author_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300">{c.author_name}</span>
                  <span className="text-xs text-gray-400 dark:text-neutral-500">
                    {new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-neutral-300 whitespace-pre-wrap break-words">{c.comment_text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      <div className="p-3 border-t border-gray-200 dark:border-neutral-700 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Add a comment… (Enter to send)"
          rows={2}
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="self-end p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors duration-150"
          aria-label="Send comment"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
