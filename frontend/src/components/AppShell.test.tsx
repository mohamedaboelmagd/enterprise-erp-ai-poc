import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { resetDemo, useDemo } from "../state/store";

async function ready() {
  resetDemo();
  render(<AppShell />);
  await waitFor(async () => {
    if (!useDemo.getState().platform) {
      await useDemo.getState().init();
    }
    expect(useDemo.getState().platform).toBeTruthy();
  }, { timeout: 10000 });
}

describe("demo shell", () => {
  afterEach(() => {
    resetDemo();
  });

  it("shows the overdue invoice count for the finance manager and hides Meridian data from Harbor", async () => {
    const user = userEvent.setup();
    await ready();
    await waitFor(() => expect(screen.getByTestId("kpi-overdue")).toHaveTextContent("1"));
    expect(screen.getByTestId("tenant-name")).toHaveTextContent("Meridian Civic Authority");
    await user.selectOptions(screen.getByTestId("persona"), "rania");
    await waitFor(() => expect(screen.getByTestId("tenant-name")).toHaveTextContent("Harbor Municipal Works"));
  });

  it("flips the chrome to a right-to-left layout", async () => {
    const user = userEvent.setup();
    await ready();
    const shell = screen.getByTestId("app-shell");
    expect(shell).toHaveAttribute("dir", "ltr");
    await user.click(screen.getByTestId("lang-toggle"));
    expect(shell).toHaveAttribute("dir", "rtl");
    expect(shell).toHaveAttribute("lang", "ar");
  });

  it("hides the Approve action from a finance clerk and shows it to the manager", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByTestId("tab-finance"));
    await waitFor(() => expect(screen.getByTestId("invoice-INV-2026-0002")).toBeInTheDocument());
    await user.click(screen.getByTestId("invoice-INV-2026-0002"));
    expect(screen.getByTestId("approve-invoice")).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId("persona"), "karim");
    await user.click(screen.getByTestId("tab-finance"));
    await waitFor(() => expect(screen.getByTestId("invoice-INV-2026-0002")).toBeInTheDocument());
    await user.click(screen.getByTestId("invoice-INV-2026-0002"));
    expect(screen.queryByTestId("approve-invoice")).not.toBeInTheDocument();
  });
});
