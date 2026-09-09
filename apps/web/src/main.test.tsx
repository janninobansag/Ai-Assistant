// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./main";

describe("mobile app session states", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  });
  it("shows the sign-in form after an unavailable session", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Create your account")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
  });
});
