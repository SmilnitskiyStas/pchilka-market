'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ReactionType = 'like' | 'dislike' | null;

type ReplyItem = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  likes: number;
};

type CommentItem = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: ReplyItem[];
};

type EngagementState = {
  likes: number;
  dislikes: number;
  userReaction: ReactionType;
  comments: CommentItem[];
  likedItemIds: string[];
};

type BlogEngagementProps = {
  slug: string;
};

type ReplyDraft = {
  authorName: string;
  text: string;
};

const EMPTY_STATE: EngagementState = {
  likes: 0,
  dislikes: 0,
  userReaction: null,
  comments: [],
  likedItemIds: []
};

const MIN_COMMENT_LENGTH = 10;

function storageKey(slug: string) {
  return `blog_engagement_${slug}`;
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeDate(value: unknown) {
  if (typeof value !== 'string') return new Date().toISOString();
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return new Date().toISOString();
  return new Date(time).toISOString();
}

function normalizeReply(raw: unknown): ReplyItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ReplyItem>;
  if (typeof item.authorName !== 'string' || typeof item.text !== 'string') return null;

  return {
    id: typeof item.id === 'string' ? item.id : makeId(),
    authorName: item.authorName.trim().slice(0, 60),
    text: item.text.trim().slice(0, 500),
    createdAt: safeDate(item.createdAt),
    likes: typeof item.likes === 'number' && item.likes > 0 ? Math.floor(item.likes) : 0
  };
}

function normalizeComment(raw: unknown): CommentItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<CommentItem>;
  if (typeof item.authorName !== 'string' || typeof item.text !== 'string') return null;

  const replies = Array.isArray(item.replies)
    ? item.replies.map(normalizeReply).filter((reply): reply is ReplyItem => reply !== null)
    : [];

  return {
    id: typeof item.id === 'string' ? item.id : makeId(),
    authorName: item.authorName.trim().slice(0, 60),
    text: item.text.trim().slice(0, 500),
    createdAt: safeDate(item.createdAt),
    likes: typeof item.likes === 'number' && item.likes > 0 ? Math.floor(item.likes) : 0,
    replies
  };
}

function normalizeState(raw: unknown): EngagementState {
  if (!raw || typeof raw !== 'object') return EMPTY_STATE;
  const parsed = raw as Partial<EngagementState>;

  return {
    likes: typeof parsed.likes === 'number' && parsed.likes > 0 ? Math.floor(parsed.likes) : 0,
    dislikes: typeof parsed.dislikes === 'number' && parsed.dislikes > 0 ? Math.floor(parsed.dislikes) : 0,
    userReaction: parsed.userReaction === 'like' || parsed.userReaction === 'dislike' ? parsed.userReaction : null,
    comments: Array.isArray(parsed.comments)
      ? parsed.comments.map(normalizeComment).filter((comment): comment is CommentItem => comment !== null)
      : [],
    likedItemIds: Array.isArray(parsed.likedItemIds)
      ? parsed.likedItemIds.filter((id): id is string => typeof id === 'string')
      : []
  };
}

function likeKey(prefix: 'comment' | 'reply', id: string) {
  return `${prefix}:${id}`;
}

function sortByNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function sortByOldest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function BlogEngagement({ slug }: BlogEngagementProps) {
  const [state, setState] = useState<EngagementState>(EMPTY_STATE);
  const [draftAuthorName, setDraftAuthorName] = useState('');
  const [draftComment, setDraftComment] = useState('');
  const [openReplyFormForId, setOpenReplyFormForId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, ReplyDraft>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (!raw) {
        setState(EMPTY_STATE);
      } else {
        setState(normalizeState(JSON.parse(raw)));
      }
    } catch {
      setState(EMPTY_STATE);
    } finally {
      setIsReady(true);
      setOpenReplyFormForId(null);
      setReplyDrafts({});
    }
  }, [slug]);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(storageKey(slug), JSON.stringify(state));
  }, [slug, state, isReady]);

  const sortedComments = useMemo(
    () =>
      sortByNewest(state.comments).map((comment) => ({
        ...comment,
        replies: sortByOldest(comment.replies)
      })),
    [state.comments]
  );

  const setReaction = (nextReaction: ReactionType) => {
    setState((prev) => {
      const next = { ...prev };

      if (prev.userReaction === 'like') next.likes = Math.max(0, next.likes - 1);
      if (prev.userReaction === 'dislike') next.dislikes = Math.max(0, next.dislikes - 1);

      if (prev.userReaction === nextReaction) {
        next.userReaction = null;
        return next;
      }

      if (nextReaction === 'like') next.likes += 1;
      if (nextReaction === 'dislike') next.dislikes += 1;
      next.userReaction = nextReaction;
      return next;
    });
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const authorName = draftAuthorName.trim();
    const text = draftComment.trim();
    if (!authorName || text.length < MIN_COMMENT_LENGTH) return;

    const comment: CommentItem = {
      id: makeId(),
      authorName: authorName.slice(0, 60),
      text: text.slice(0, 500),
      createdAt: new Date().toISOString(),
      likes: 0,
      replies: []
    };

    setState((prev) => ({
      ...prev,
      comments: [comment, ...prev.comments]
    }));
    setDraftAuthorName('');
    setDraftComment('');
  };

  const toggleCommentLike = (commentId: string) => {
    const key = likeKey('comment', commentId);

    setState((prev) => {
      const alreadyLiked = prev.likedItemIds.includes(key);

      return {
        ...prev,
        likedItemIds: alreadyLiked
          ? prev.likedItemIds.filter((id) => id !== key)
          : [...prev.likedItemIds, key],
        comments: prev.comments.map((comment) => {
          if (comment.id !== commentId) return comment;
          return {
            ...comment,
            likes: alreadyLiked ? Math.max(0, comment.likes - 1) : comment.likes + 1
          };
        })
      };
    });
  };

  const toggleReplyLike = (commentId: string, replyId: string) => {
    const key = likeKey('reply', replyId);

    setState((prev) => {
      const alreadyLiked = prev.likedItemIds.includes(key);

      return {
        ...prev,
        likedItemIds: alreadyLiked
          ? prev.likedItemIds.filter((id) => id !== key)
          : [...prev.likedItemIds, key],
        comments: prev.comments.map((comment) => {
          if (comment.id !== commentId) return comment;

          return {
            ...comment,
            replies: comment.replies.map((reply) => {
              if (reply.id !== replyId) return reply;

              return {
                ...reply,
                likes: alreadyLiked ? Math.max(0, reply.likes - 1) : reply.likes + 1
              };
            })
          };
        })
      };
    });
  };

  const getReplyDraft = (commentId: string): ReplyDraft => {
    return replyDrafts[commentId] ?? { authorName: '', text: '' };
  };

  const updateReplyDraft = (commentId: string, next: Partial<ReplyDraft>) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: {
        ...getReplyDraft(commentId),
        ...next
      }
    }));
  };

  const toggleReplyForm = (commentId: string) => {
    setOpenReplyFormForId((prev) => (prev === commentId ? null : commentId));
  };

  const addReply = (event: FormEvent<HTMLFormElement>, commentId: string) => {
    event.preventDefault();
    const draft = getReplyDraft(commentId);
    const authorName = draft.authorName.trim();
    const text = draft.text.trim();

    if (!authorName || text.length < MIN_COMMENT_LENGTH) return;

    const reply: ReplyItem = {
      id: makeId(),
      authorName: authorName.slice(0, 60),
      text: text.slice(0, 500),
      createdAt: new Date().toISOString(),
      likes: 0
    };

    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((comment) => {
        if (comment.id !== commentId) return comment;
        return {
          ...comment,
          replies: [...comment.replies, reply]
        };
      })
    }));

    setReplyDrafts((prev) => ({
      ...prev,
      [commentId]: { authorName: '', text: '' }
    }));
    setOpenReplyFormForId(null);
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-slate-900">Реакції та коментарі</h2>
      <p className="mt-2 text-sm text-slate-600">Оцініть статтю та залиште коментар.</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setReaction('like')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            state.userReaction === 'like'
              ? 'border-brand bg-brand text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
          }`}
        >
          👍 Сподобалась ({state.likes})
        </button>
        <button
          type="button"
          onClick={() => setReaction('dislike')}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            state.userReaction === 'dislike'
              ? 'border-slate-700 bg-slate-700 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-900'
          }`}
        >
          👎 Не сподобалась ({state.dislikes})
        </button>
      </div>

      <form onSubmit={addComment} className="mt-6">
        <label htmlFor="authorName" className="block text-sm font-semibold text-slate-900">
          Як вас звати <span className="text-red-600">*</span>
        </label>
        <input
          id="authorName"
          value={draftAuthorName}
          onChange={(e) => setDraftAuthorName(e.target.value)}
          maxLength={60}
          required
          placeholder="Вкажіть ваше ім'я"
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
        />

        <label htmlFor="comment" className="mt-4 block text-sm font-semibold text-slate-900">
          Ваш коментар <span className="text-red-600">*</span>
        </label>
        <textarea
          id="comment"
          value={draftComment}
          onChange={(e) => setDraftComment(e.target.value)}
          rows={4}
          minLength={MIN_COMMENT_LENGTH}
          maxLength={500}
          required
          placeholder="Напишіть вашу думку про статтю..."
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none transition focus:border-brand"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            {draftComment.length}/500 (мінімум {MIN_COMMENT_LENGTH})
          </span>
          <button
            type="submit"
            disabled={draftComment.trim().length < MIN_COMMENT_LENGTH || draftAuthorName.trim().length === 0}
            className="cursor-pointer rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Додати коментар
          </button>
        </div>
        {draftComment.trim().length > 0 && draftComment.trim().length < MIN_COMMENT_LENGTH ? (
          <p className="mt-2 text-xs font-semibold text-red-600">
            Коментар повинен містити мінімум {MIN_COMMENT_LENGTH} символів.
          </p>
        ) : null}
      </form>

      <div className="mt-6 space-y-3">
        {sortedComments.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Поки що немає коментарів.</p>
        ) : (
          sortedComments.map((comment) => {
            const commentLikeId = likeKey('comment', comment.id);
            const replyDraft = getReplyDraft(comment.id);
            const isReplyOpen = openReplyFormForId === comment.id;

            return (
              <article key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{comment.authorName}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800 [overflow-wrap:anywhere]">
                  {comment.text}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString('uk-UA')}</p>
                  <button
                    type="button"
                    onClick={() => toggleCommentLike(comment.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      state.likedItemIds.includes(commentLikeId)
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
                    }`}
                  >
                    👍 Корисно ({comment.likes})
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleReplyForm(comment.id)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                  >
                    {isReplyOpen ? 'Скасувати' : 'Відповісти'}
                  </button>
                </div>

                {isReplyOpen ? (
                  <form onSubmit={(event) => addReply(event, comment.id)} className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <label htmlFor={`reply-author-${comment.id}`} className="block text-xs font-semibold text-slate-900">
                      Ваше ім'я <span className="text-red-600">*</span>
                    </label>
                    <input
                      id={`reply-author-${comment.id}`}
                      value={replyDraft.authorName}
                      onChange={(event) => updateReplyDraft(comment.id, { authorName: event.target.value })}
                      maxLength={60}
                      required
                      placeholder="Вкажіть ваше ім'я"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none transition focus:border-brand"
                    />

                    <label htmlFor={`reply-text-${comment.id}`} className="mt-3 block text-xs font-semibold text-slate-900">
                      Відповідь <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id={`reply-text-${comment.id}`}
                      value={replyDraft.text}
                      onChange={(event) => updateReplyDraft(comment.id, { text: event.target.value })}
                      rows={3}
                      minLength={MIN_COMMENT_LENGTH}
                      maxLength={500}
                      required
                      placeholder="Напишіть відповідь на коментар..."
                      className="mt-1.5 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none transition focus:border-brand"
                    />

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {replyDraft.text.length}/500 (мінімум {MIN_COMMENT_LENGTH})
                      </span>
                      <button
                        type="submit"
                        disabled={
                          replyDraft.text.trim().length < MIN_COMMENT_LENGTH ||
                          replyDraft.authorName.trim().length === 0
                        }
                        className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Надіслати відповідь
                      </button>
                    </div>
                  </form>
                ) : null}

                {comment.replies.length > 0 ? (
                  <div className="mt-3 space-y-2 border-l-2 border-brand/30 pl-3">
                    {comment.replies.map((reply) => {
                      const replyLikeId = likeKey('reply', reply.id);

                      return (
                        <article key={reply.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-900">{reply.authorName}</p>
                          <p className="whitespace-pre-wrap break-words text-sm text-slate-800 [overflow-wrap:anywhere]">
                            {reply.text}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <p className="text-xs text-slate-500">{new Date(reply.createdAt).toLocaleString('uk-UA')}</p>
                            <button
                              type="button"
                              onClick={() => toggleReplyLike(comment.id, reply.id)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                state.likedItemIds.includes(replyLikeId)
                                  ? 'border-brand bg-brand/10 text-brand'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand hover:text-brand'
                              }`}
                            >
                              👍 Корисно ({reply.likes})
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
