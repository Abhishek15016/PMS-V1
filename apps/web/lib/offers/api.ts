import type { CreateOfferInput, CreatePpoOfferInput, Offer } from "@pms/types";
import { apiFetch } from "../api-client";

export function listOffers(): Promise<Offer[]> {
  return apiFetch<Offer[]>("/offers");
}

export function createOffer(dto: CreateOfferInput): Promise<Offer> {
  return apiFetch<Offer>("/offers", { method: "POST", body: JSON.stringify(dto) });
}

export function createPpoOffer(dto: CreatePpoOfferInput): Promise<Offer> {
  return apiFetch<Offer>("/offers/ppo", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export function approveOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/approve`, { method: "POST" });
}

export function acceptOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/accept`, { method: "POST" });
}

export function rejectOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/reject`, { method: "POST" });
}

export function revokeOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/revoke`, { method: "POST" });
}
