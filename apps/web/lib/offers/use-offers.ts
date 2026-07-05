import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateOfferInput, CreatePpoOfferInput } from "@pms/types";
import { useAuthStore } from "../auth/auth-store";
import {
  acceptOffer,
  approveOffer,
  createOffer,
  createPpoOffer,
  listOffers,
  rejectOffer,
  revokeOffer,
} from "./api";

export function useOffers() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  return useQuery({
    queryKey: ["offers", accessToken],
    queryFn: listOffers,
    enabled: hasHydrated && !!accessToken,
    retry: false,
  });
}

function useOfferMutation(mutationFn: (id: string) => ReturnType<typeof acceptOffer>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOfferInput) => createOffer(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

export function useCreatePpoOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePpoOfferInput) => createPpoOffer(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
  });
}

export function useApproveOffer() {
  return useOfferMutation(approveOffer);
}

export function useAcceptOffer() {
  return useOfferMutation(acceptOffer);
}

export function useRejectOffer() {
  return useOfferMutation(rejectOffer);
}

export function useRevokeOffer() {
  return useOfferMutation(revokeOffer);
}
