import "@testing-library/jest-dom";
import { vi } from "vitest";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

window.ResizeObserver = MockResizeObserver;
global.ResizeObserver = MockResizeObserver;

