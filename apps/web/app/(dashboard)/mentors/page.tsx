"use client";

import { useState } from "react";
import {
  Award,
  CheckCircle2,
  HeartHandshake,
  MessageCircleQuestion,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  cn,
  useToast,
} from "@pms/ui";
import type { MentorCard, MentorThread } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useStudents } from "@/lib/students/use-students";
import {
  useCreateReply,
  useCreateThread,
  useMentors,
  useThread,
  useThreads,
  useUpdateMentorProfile,
} from "@/lib/mentorship/use-mentorship";
import { CompanyLogo } from "@/components/company-logo";

type Tab = "mentors" | "threads";

export default function MentorConnectPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isStudent = role === "STUDENT";
  const isStaff = role === "SUPER_ADMIN" || role === "TPO" || role === "FACULTY_COORD";

  const [tab, setTab] = useState<Tab>("mentors");
  const [askMentor, setAskMentor] = useState<MentorCard | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  const mentors = useMentors();
  const threads = useThreads();
  const students = useStudents();
  const me = isStudent ? students.data?.[0] : undefined;
  const isPlaced = me?.placementStatus === "PLACED";

  if (!isStudent && !isStaff) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <EmptyState title="Mentor Connect is for students and placement staff" />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Mentor Connect"
        description="Placed seniors answering the questions that actually matter — company-specific, batch-specific, honest."
        actions={
          isStudent && (
            <Button onClick={() => { setAskMentor(null); setAskOpen(true); }}>
              <MessageCircleQuestion className="h-4 w-4" />
              Ask the community
            </Button>
          )
        }
      />

      {isPlaced && me && <BecomeMentorCard optIn={me.mentorOptIn} headline={me.mentorHeadline} />}

      <Tabs
        items={[
          { value: "mentors", label: `Mentors${mentors.data ? ` (${mentors.data.length})` : ""}` },
          { value: "threads", label: `Q&A board${threads.data ? ` (${threads.data.length})` : ""}` },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {tab === "mentors" ? (
        mentors.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (mentors.data?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mentors.data!.map((mentor) => (
              <Card key={mentor.studentId} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <Avatar name={mentor.displayName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{mentor.displayName}</p>
                    <p className="text-xs text-neutral-500">
                      {mentor.departmentCode} · Batch {mentor.batchLabel}
                    </p>
                  </div>
                  {mentor.companyName && (
                    <CompanyLogo name={mentor.companyName} website={mentor.companyWebsite} size="sm" />
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {mentor.companyName && (
                    <Badge tone="brand">
                      {mentor.companyName}
                      {mentor.ctcLpa ? ` · ₹${mentor.ctcLpa}L` : ""}
                    </Badge>
                  )}
                  {mentor.isPpo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                      <Sparkles className="h-3 w-3" /> PPO
                    </span>
                  )}
                  {mentor.answeredCount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      {mentor.answeredCount} answer{mentor.answeredCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                {mentor.headline && (
                  <p className="mt-2 text-sm italic text-neutral-600">&ldquo;{mentor.headline}&rdquo;</p>
                )}
                {isStudent && me?.id !== mentor.studentId && (
                  <div className="mt-auto pt-3">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => { setAskMentor(mentor); setAskOpen(true); }}
                    >
                      <MessageCircleQuestion className="h-4 w-4" />
                      Ask {mentor.displayName.split(" ")[0]}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<HeartHandshake className="h-5 w-5" />}
              title="No mentors yet"
              description="Placed students can opt in as mentors — the directory fills up as offers land."
            />
          </Card>
        )
      ) : (
        <ThreadsBoard
          threads={threads.data ?? []}
          isLoading={threads.isLoading}
          openThreadId={openThreadId}
          onOpenThread={setOpenThreadId}
          canPost={isStudent || isStaff}
        />
      )}

      {askOpen && (
        <AskDialog
          mentor={askMentor}
          onClose={() => setAskOpen(false)}
          onCreated={(id) => {
            setAskOpen(false);
            setTab("threads");
            setOpenThreadId(id);
          }}
        />
      )}
    </div>
  );
}

function BecomeMentorCard({ optIn, headline }: { optIn: boolean; headline: string | null }) {
  const update = useUpdateMentorProfile();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(headline ?? "");

  async function toggle(next: boolean, newHeadline?: string | null) {
    try {
      await update.mutateAsync({
        mentorOptIn: next,
        mentorHeadline: newHeadline === undefined ? headline : newHeadline,
      });
      show({
        tone: "success",
        title: next ? "You're listed as a mentor" : "You've stepped off the mentor list",
      });
      setEditing(false);
    } catch {
      show({ tone: "danger", title: "Couldn't update your mentor profile" });
    }
  }

  return (
    <Card className={cn("border", optIn ? "border-emerald-200 bg-emerald-50/40" : "border-brand-200 bg-brand-50/40")}>
      <div className="flex flex-wrap items-center gap-3">
        <Award className={cn("h-5 w-5", optIn ? "text-emerald-600" : "text-brand-600")} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            {optIn ? "You're mentoring your juniors — thank you." : "You made it. Help the next batch make it too."}
          </p>
          <p className="text-xs text-neutral-500">
            {optIn
              ? headline || "Add a headline so juniors know what to ask you about."
              : "Opt in and unplaced students can ask you company-specific questions."}
          </p>
        </div>
        {editing ? (
          <form
            className="flex w-full items-end gap-2 sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              void toggle(true, draft.trim() || null);
            }}
          >
            <div className="min-w-56 flex-1">
              <Label htmlFor="mentor-headline">Headline</Label>
              <Input
                id="mentor-headline"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="SDE @ Razorpay — ask me about fintech interviews"
                maxLength={140}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Go live"}
            </Button>
          </form>
        ) : optIn ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit headline
            </Button>
            <Button variant="ghost" onClick={() => void toggle(false)} disabled={update.isPending}>
              Opt out
            </Button>
          </div>
        ) : (
          <Button onClick={() => setEditing(true)}>
            <HeartHandshake className="h-4 w-4" />
            Become a mentor
          </Button>
        )}
      </div>
    </Card>
  );
}

function ThreadsBoard({
  threads,
  isLoading,
  openThreadId,
  onOpenThread,
  canPost,
}: {
  threads: MentorThread[];
  isLoading: boolean;
  openThreadId: string | null;
  onOpenThread: (id: string | null) => void;
  canPost: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (threads.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No questions yet"
          description="Ask the first one — mentors get notified on the board."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {threads.map((thread) =>
        openThreadId === thread.id ? (
          <ThreadDetail key={thread.id} threadId={thread.id} onClose={() => onOpenThread(null)} canPost={canPost} />
        ) : (
          <button
            key={thread.id}
            type="button"
            onClick={() => onOpenThread(thread.id)}
            className="w-full text-left"
          >
            <Card interactive>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{thread.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{thread.body}</p>
                  <p className="mt-1.5 text-[11px] text-neutral-400">
                    {thread.authorName}
                    {thread.mentorName ? ` → ${thread.mentorName}` : " → community"} ·{" "}
                    {new Date(thread.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                    {thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"}
                  </p>
                </div>
                <Badge tone={thread.status === "ANSWERED" ? "success" : "warning"} dot>
                  {thread.status}
                </Badge>
              </div>
            </Card>
          </button>
        ),
      )}
    </div>
  );
}

function ThreadDetail({
  threadId,
  onClose,
  canPost,
}: {
  threadId: string;
  onClose: () => void;
  canPost: boolean;
}) {
  const thread = useThread(threadId);
  const reply = useCreateReply(threadId);
  const { show } = useToast();
  const [body, setBody] = useState("");

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    try {
      await reply.mutateAsync({ body });
      setBody("");
      show({ tone: "success", title: "Reply posted" });
    } catch {
      show({ tone: "danger", title: "Couldn't post the reply" });
    }
  }

  const data = thread.data;
  return (
    <Card className="border-brand-200">
      {thread.isLoading || !data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-900">{data.title}</p>
              <p className="mt-0.5 text-[11px] text-neutral-400">
                {data.authorName}
                {data.mentorName ? ` → ${data.mentorName}` : " → community"} ·{" "}
                {new Date(data.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={data.status === "ANSWERED" ? "success" : "warning"} dot>
                {data.status}
              </Badge>
              <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onClose}>
                Collapse
              </Button>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{data.body}</p>

          {(data.replies?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
              {data.replies!.map((r) => (
                <div key={r.id} className="flex gap-2.5">
                  <Avatar name={r.authorName} size="sm" />
                  <div className="min-w-0 flex-1 rounded-[var(--radius-md)] bg-neutral-50 p-3">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold text-neutral-900">{r.authorName}</span>
                      {r.authorRole !== "STUDENT" ? (
                        <Badge tone="info">Placement cell</Badge>
                      ) : r.authorIsPlaced ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Placed senior
                        </span>
                      ) : null}
                      <span className="text-neutral-400">
                        {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canPost && (
            <form className="mt-4 flex items-end gap-2 border-t border-neutral-100 pt-4" onSubmit={handleReply}>
              <div className="flex-1">
                <Label htmlFor={`reply-${threadId}`}>Your reply</Label>
                <Input
                  id={`reply-${threadId}`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share what you actually did — specifics beat platitudes."
                  minLength={2}
                  required
                />
              </div>
              <Button type="submit" disabled={reply.isPending || body.trim().length < 2}>
                <Send className="h-4 w-4" />
                {reply.isPending ? "Posting…" : "Reply"}
              </Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

function AskDialog({
  mentor,
  onClose,
  onCreated,
}: {
  mentor: MentorCard | null;
  onClose: () => void;
  onCreated: (threadId: string) => void;
}) {
  const createThread = useCreateThread();
  const mentors = useMentors();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mentorStudentId, setMentorStudentId] = useState(mentor?.studentId ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const thread = await createThread.mutateAsync({
        title,
        body,
        mentorStudentId: mentorStudentId || undefined,
      });
      show({ tone: "success", title: "Question posted" });
      onCreated(thread.id);
    } catch {
      show({
        tone: "danger",
        title: "Couldn't post the question",
        description: "Title needs 8+ characters and the question 20+.",
      });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mentor ? `Ask ${mentor.displayName}` : "Ask the community"}
      description="Your question is visible to everyone in your institution — good answers help the whole batch."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="thread-mentor">Direct to</Label>
          <Select
            id="thread-mentor"
            value={mentorStudentId}
            onChange={(e) => setMentorStudentId(e.target.value)}
          >
            <option value="">Whole community</option>
            {(mentors.data ?? []).map((m) => (
              <option key={m.studentId} value={m.studentId}>
                {m.displayName}
                {m.companyName ? ` — ${m.companyName}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="thread-title">Question title</Label>
          <Input
            id="thread-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How did you prepare for Razorpay's second technical round?"
            minLength={8}
            maxLength={160}
            required
            autoFocus={!mentor}
          />
        </div>
        <div>
          <Label htmlFor="thread-body">Details</Label>
          <textarea
            id="thread-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            minLength={20}
            required
            placeholder="Where you are in the pipeline, what you've tried, what specifically you want to know."
            className="w-full rounded-[var(--radius-md)] border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createThread.isPending}>
            {createThread.isPending ? "Posting…" : "Post question"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
