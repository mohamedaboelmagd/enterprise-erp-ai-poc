import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { resetDemo, useDemo } from "../state/store";

describe("AI assistant view", () => {
  afterEach(() => resetDemo());

  it("filters overdue invoices from a natural-language prompt and extracts invoice fields", async () => {
    const user = userEvent.setup();
    resetDemo();
    render(<AppShell />);
    await waitFor(async () => {
      if (!useDemo.getState().platform) await useDemo.getState().init();
      expect(useDemo.getState().platform).toBeTruthy();
    }, { timeout: 10000 });
    await user.click(screen.getByTestId("tab-assistant"));
    await user.click(screen.getByTestId("ai-ask"));
    await waitFor(() => expect(screen.getByTestId("ai-filter-result")).toHaveTextContent("INV-2026-0001"));
    expect(screen.getByTestId("ai-filter-result")).not.toHaveTextContent("INV-2026-0005");
    await user.click(screen.getByTestId("extract-run"));
    await waitFor(() => expect(screen.getByTestId("extract-result")).toHaveTextContent("Cedar Maintenance Group"));
    expect(screen.getByTestId("extract-result")).toHaveTextContent("Generator maintenance");
  });
});
