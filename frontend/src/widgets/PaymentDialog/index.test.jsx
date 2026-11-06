import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PaymentLauncher, openPayment } from "./index";
import { paymentMethods, previewPayment, createPayment, getPayment, claimPayment } from "../../entities/payment/api/paymentSessions";

const mockLoadProfile = jest.fn();
jest.mock("../../app/auth/AuthContext", () => ({ useAuth: () => ({ user: { balance: 100 }, isAuthenticated: true, loadUserProfile: mockLoadProfile }) }));
jest.mock("../../shared/ui/Modal/Modal", () => ({ Modal: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null }));
jest.mock("../../entities/payment/api/paymentSessions", () => ({ paymentMethods: jest.fn(), previewPayment: jest.fn(), createPayment: jest.fn(), getPayment: jest.fn(), claimPayment: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

describe("Payment dialog", () => {
  let container, root;
  const quote = { amount_rub: "500", balance_used: "0", external_rub: "500", currency: "UAH", estimated_amount: "250" };
  const pending = { id: "payment-1", purpose: "balance", method: "ukraine", status: "pending", amount_rub: "500", amount: "250.01", currency: "UAH", expires_at: new Date(Date.now() + 1800000).toISOString(), details: { card: "0000000000000000", bank: "ПриватБанк", recipient: "Тест" } };
  const flush = async () => { await act(async () => { await Promise.resolve(); }); };
  const advance = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
  const click = async (text) => { const button = [...container.querySelectorAll("button")].find((node) => node.textContent.includes(text)); expect(button).toBeDefined(); await act(async () => button.click()); };

  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    if (!window.crypto) Object.defineProperty(window, "crypto", { value: {}, configurable: true });
    if (!window.crypto.randomUUID) Object.defineProperty(window.crypto, "randomUUID", { value: () => "test-request-id", configurable: true });
    paymentMethods.mockResolvedValue([{ id: "russia", title: "Россия", available: true }, { id: "ukraine", title: "Украина", available: true }, { id: "crypto", title: "Криптовалюта", available: true }]);
    previewPayment.mockResolvedValue(quote);
    createPayment.mockResolvedValue(pending);
    getPayment.mockResolvedValue(pending);
    claimPayment.mockResolvedValue({ ...pending, status: "checking" });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PaymentLauncher /></MemoryRouter>));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllTimers(); jest.useRealTimers(); });

  async function openOrders() {
    act(() => openPayment({ purpose: "orders", order_public_ids: ["#ORDER001", "#ORDER002"] }));
    await flush(); await click("Украина"); await advance(401); await flush();
  }

  test("passes the whole basket and never trusts a client total", async () => {
    await openOrders(); await click("Получить реквизиты");
    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(createPayment.mock.calls[0][0].order_public_ids).toEqual(["#ORDER001", "#ORDER002"]);
    expect(createPayment.mock.calls[0][0].amount_rub).toBeUndefined();
    expect(container.textContent).toContain("250.01");
  });

  test("double click while creating a payment sends only one request", async () => {
    let resolve;
    createPayment.mockReturnValue(new Promise((done) => { resolve = done; }));
    await openOrders();
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent === "Получить реквизиты");
    act(() => { button.click(); button.click(); });
    expect(createPayment).toHaveBeenCalledTimes(1);
    await act(async () => resolve(pending));
  });

  test("I paid shows checking and never shows success without server confirmation", async () => {
    await openOrders(); await click("Получить реквизиты"); await click("Я оплатил");
    expect(claimPayment).toHaveBeenCalledWith("payment-1");
    expect(container.textContent).toContain("Проверяем поступление");
    expect(mockLoadProfile).not.toHaveBeenCalled();
    getPayment.mockResolvedValue({ ...pending, status: "confirmed" });
    await advance(2001); await flush();
    expect(mockLoadProfile).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Баланс пополнен");
  });

  test("network retry keeps the same idempotency key", async () => {
    createPayment.mockRejectedValueOnce(new Error("Соединение потеряно")).mockResolvedValueOnce(pending);
    await openOrders(); await click("Получить реквизиты");
    expect(container.textContent).toContain("Соединение потеряно");
    await click("Получить реквизиты");
    expect(createPayment.mock.calls[0][0].request_id).toBe(createPayment.mock.calls[1][0].request_id);
  });

  test("shows only supported USDT networks", async () => {
    await openOrders(); await click("Криптовалюта");
    expect([...container.querySelectorAll("option")].map((node) => node.value)).toEqual(["TRC20", "BEP20"]);
  });
});
