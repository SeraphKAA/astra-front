import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import OrdersPage from "./index";
import { useMyOrders } from "../../entities/order/model/useOrders";

jest.mock("../../entities/order/model/useOrders", () => ({ useMyOrders: jest.fn() }));
jest.mock("../../shared/ui/Toast/ToastProvider", () => ({ useToast: () => ({ pushToast: jest.fn() }) }));
jest.mock("../../app/unread/UnreadContext", () => ({ useUnreadCounts: () => ({ counts: {} }) }));
jest.mock("../../shared/ui/Modal/Modal", () => ({ Modal: ({ isOpen, children }) => isOpen ? <div role="dialog">{children}</div> : null }));

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("Order card seller chat", () => {
    let container;
    let root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    test.each([
        ["paid individual application awaiting seller", true, null, "individual_order", true, true],
        ["unpaid individual application", false, null, "individual_order", true, false],
        ["paid individual application with seller", true, 10, "individual_order", true, true],
        ["ordinary manual order with seller", true, 10, undefined, true, true],
        ["ordinary manual order awaiting seller", true, null, undefined, true, false],
        ["automatic order", true, null, undefined, false, false],
    ])("%s", (_name, paid, seller, kind, manual, expectedChat) => {
        useMyOrders.mockReturnValue({
            data: [{
                id: 123, public_id: "#TEST123", product_name: kind ? "Индивидуальный заказ" : "Товар",
                total_price: 1, status: paid ? "paid" : "created", is_paid: paid,
                order_type: manual ? "manual" : "auto", requires_manual_processing: manual,
                assigned_seller_id: seller, customer_checkout_data: kind ? { kind } : null,
                created_at: "2026-10-27T12:00:00Z",
            }],
            isLoading: false, error: null, refetch: jest.fn(),
        });
        act(() => root.render(
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <OrdersPage />
            </MemoryRouter>
        ));
        const chat = container.querySelector('a[href="/order-chat/123"]');
        expect(Boolean(chat)).toBe(expectedChat);
        if (chat) expect(chat.textContent).toContain("Чат с продавцом");
        if (!paid) expect(container.textContent).toContain("Оплатить");
    });

    test("a delivered decoration exposes its gift URL and copy button", () => {
        useMyOrders.mockReturnValue({ data: [{ id: 456, public_id: "#GIFT1234", product_name: "Украшение Discord",
            total_price: 100, status: "completed", is_paid: true, is_auto: true, requires_manual_processing: false,
            delivered_payload: { gift_url: "https://discord.gift/TESTONLYGIFT" }, created_at: "2026-10-27T12:00:00Z" }],
            isLoading: false, error: null, refetch: jest.fn() });
        act(() => root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><OrdersPage /></MemoryRouter>));
        act(() => container.querySelector(".orders-card-title").click());
        expect(container.textContent).toContain("https://discord.gift/TESTONLYGIFT");
        expect(container.querySelector('button[aria-label*="Скопировать"]')).not.toBeNull();
    });
});
