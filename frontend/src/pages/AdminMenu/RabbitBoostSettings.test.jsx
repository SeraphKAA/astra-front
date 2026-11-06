import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { RabbitBoostSettings, withRabbitService } from "./RabbitBoostSettings";
import { apiRequest } from "../../shared/commonApi";

jest.mock("../../shared/commonApi", () => ({ apiRequest: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

describe("RabbitBoost product settings", () => {
  let container, root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); jest.clearAllMocks(); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function Form({ service }) {
    const [form, setForm] = useState(withRabbitService({}, service));
    return <><RabbitBoostSettings form={form} onChange={setForm} /><output data-testid="params">{form.provider_params_json}</output></>;
  }
  const render = (service = "discord_boosts") => act(() => root.render(<Form service={service} />));
  const change = (selector, value) => {
    const input = container.querySelector(selector);
    act(() => {
      if (input.tagName === "SELECT") { input.value = value; input.dispatchEvent(new Event("change", { bubbles: true })); }
      else { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }
    });
  };
  test("edits duration and boost count without JSON", () => {
    render(); change("#rabbit-duration", "threeMonth"); change("#rabbit-count", "14");
    expect(JSON.parse(container.querySelector("output").textContent)).toEqual({ duration: "threeMonth", count: 14, customize: false });
  });
  test("switches to decorations and keeps the full SKU precision", () => {
    render(); change("#rabbit-service", "discord_decoration"); change("#rabbit-sku", "1234567890123456789");
    expect(container.querySelector("#rabbit-count")).toBeNull();
    expect(JSON.parse(container.querySelector("output").textContent)).toEqual({ sku_id: "1234567890123456789" });
  });
  test("catalog search is read only and selects an existing SKU", async () => {
    apiRequest.mockResolvedValue([{ sku_id: "1234567890123456789", name: "Украшение", price_rub: "200" }]);
    render("discord_decoration"); change("#rabbit-search", "Украшение");
    await act(async () => container.querySelector("button").click());
    expect(apiRequest.mock.calls[0][0].url).toContain("/rabbitboost/decorations?q=");
    expect(apiRequest.mock.calls[0][0].method).toBeUndefined();
    change('select[aria-label="Украшения RabbitBoost"]', "1234567890123456789");
    expect(JSON.parse(container.querySelector("output").textContent).sku_id).toBe("1234567890123456789");
  });
  test("catalog failure leaves manual SKU entry available", async () => {
    apiRequest.mockRejectedValue(new Error("offline")); render("discord_decoration"); change("#rabbit-search", "test");
    await act(async () => container.querySelector("button").click());
    expect(container.textContent).toContain("SKU можно указать вручную");
    expect(container.querySelector("#rabbit-sku").disabled).toBe(false);
  });
});
