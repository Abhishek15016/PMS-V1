import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateReplyInput,
  CreateThreadInput,
  MentorCard,
  MentorThread,
  Student,
  UpdateMentorProfileInput,
} from "@pms/types";
import { apiFetch } from "../api-client";
import { useAuthStore } from "../auth/auth-store";

function useReady() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  return hasHydrated && !!accessToken;
}

export function useMentors() {
  const ready = useReady();
  return useQuery({
    queryKey: ["mentorship", "mentors"],
    queryFn: () => apiFetch<MentorCard[]>("/mentorship/mentors"),
    enabled: ready,
    retry: false,
  });
}

export function useThreads() {
  const ready = useReady();
  return useQuery({
    queryKey: ["mentorship", "threads"],
    queryFn: () => apiFetch<MentorThread[]>("/mentorship/threads"),
    enabled: ready,
    retry: false,
  });
}

export function useThread(id: string | null) {
  const ready = useReady();
  return useQuery({
    queryKey: ["mentorship", "thread", id],
    queryFn: () => apiFetch<MentorThread>(`/mentorship/threads/${id}`),
    enabled: ready && !!id,
    retry: false,
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThreadInput) =>
      apiFetch<MentorThread>("/mentorship/threads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship", "threads"] });
    },
  });
}

export function useCreateReply(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReplyInput) =>
      apiFetch<MentorThread>(`/mentorship/threads/${threadId}/replies`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship"] });
    },
  });
}

export function useUpdateMentorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMentorProfileInput) =>
      apiFetch<Student>("/mentorship/mentor-profile", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorship"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
