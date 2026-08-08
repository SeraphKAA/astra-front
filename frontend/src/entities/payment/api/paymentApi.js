import { apiRequest } from "../../../shared/commonApi";

export const initBalanceTopupPayment = ({ amount }) => {
  return apiRequest({
    url: "/payments/robokassa/balance/topup/init",
    method: "POST",
    body: { amount },
  });
};

