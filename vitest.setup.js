import 'vitest-canvas-mock';

// Re-initialize canvas mock after vi.resetAllMocks() if needed
import { setupVitestCanvasMock } from 'vitest-canvas-mock';
global.setupVitestCanvasMock = setupVitestCanvasMock;
