import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ImageFullscreenPreview from "./ImageFullscreenPreview";

describe("ImageFullscreenPreview", () => {
  const defaultProps = {
    imageStr:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    format: "png",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = "";
  });

  it("renders correctly when given valid props", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    const img = screen.getByAltText("Fullscreen preview");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("data:image/png;base64"));
  });

  it("calls onClose when Escape is pressed", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when image is clicked", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    const img = screen.getByAltText("Fullscreen preview");
    fireEvent.click(img);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll on mount and restores on unmount", () => {
    const { unmount } = render(<ImageFullscreenPreview {...defaultProps} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("traps focus to the close button", () => {
    render(<ImageFullscreenPreview {...defaultProps} />);
    const closeBtn = screen.getByRole("button", { name: /close/i });

    // Initial focus should be on close button (or move it there if not handled automatically in test env)
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Press Tab
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("bails out for disallowed formats", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onClose = vi.fn();
    render(<ImageFullscreenPreview {...defaultProps} format="svg" onClose={onClose} />);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Blocked disallowed image format: "svg"'),
    );
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByAltText("Fullscreen preview")).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
