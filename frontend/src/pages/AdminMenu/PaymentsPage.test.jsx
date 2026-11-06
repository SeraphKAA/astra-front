import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { PaymentsPage } from "./PaymentsPage";
import { apiRequest } from "../../shared/commonApi";

jest.mock("../../shared/commonApi", () => ({ apiRequest: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

describe("bank synchronization status", () => {
  let container, root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); jest.clearAllMocks(); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  async function render(extra = {}) {
    apiRequest.mockResolvedValue({ automation_enabled: false, receipts: [], jobs: [], ...extra });
    await act(async () => root.render(<PaymentsPage />));
  }
  test("shows catchup and connection errors without claiming successful payment", async () => {
    await render({ bank_sync: { has_backlog: true, error: "unavailable", unrecognized_count: 0, retry_after: "2026-11-01T10:00:00Z" } });
    expect(container.querySelector('[role="status"]').textContent).toContain("дочитываем");
    expect(container.querySelector('[role="alert"]').textContent).toContain("сохранённой позиции");
    expect(container.textContent).toContain("Автопроверка: выключена");
    expect(container.textContent).toContain("Следующая попытка проверки");
  });
  test("shows unknown and missing messages for review", async () => {
    await render({ bank_sync: { unrecognized_count: 2 }, bank_notifications: [
      { message_id: 123, sent_at: "2026-11-01T10:00:00Z", reason: "unsupported_format" },
      { message_id: 124, sent_at: "2026-11-01T10:01:00Z", reason: "message_missing" }
    ] });
    expect(container.querySelector('[role="alert"]').textContent).toContain("на проверке: 2");
    expect(container.textContent).toContain("Уведомление #123");
    expect(container.textContent).toContain("Сообщение недоступно в Telegram");
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
  test("renders without a connected bank and handles failed refresh", async () => {
    await render({ bank_sync: null, bank_notifications: [] });
    expect(container.textContent).toContain("Проверок ещё не было");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    apiRequest.mockRejectedValue(new Error("Unavailable"));
    await act(async () => container.querySelector("button").click());
    expect(container.querySelector('[role="alert"]').textContent).toContain("Не удалось загрузить платежи");
  });
});
