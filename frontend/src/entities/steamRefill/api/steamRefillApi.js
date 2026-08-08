import { apiRequest } from "../../../shared/commonApi";

export const getSteamRefillRates = () =>
  apiRequest({
    url: "/steam-refill/rates",
  });

export const checkSteamUsername = (username) =>
  apiRequest({
    url: `/steam-refill/check-username?username=${encodeURIComponent(username)}`,
  });

export const quoteSteamRefill = (body) =>
  apiRequest({
    url: "/steam-refill/quote",
    method: "POST",
    body,
  });

export const createSteamRefillOrder = (body) =>
  apiRequest({
    url: "/steam-refill/orders",
    method: "POST",
    body,
  });
