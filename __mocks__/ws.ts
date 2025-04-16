/**
 * Mock implementation of the ws library
 */
import EventEmitter from "events";

// Define interface for the mock
interface MockWebSocketInstance extends EventEmitter {
  url: string;
  options: object;
  readyState: number;
  sentMessages: string[];
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
  send: (data: string) => boolean;
  close: (code?: number, reason?: string) => void;
  mockReceive: (data: object) => void;
  mockError: (error: Error) => void;
}

// Define constants to avoid TypeScript errors
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

/**
 * MockWebSocket - Mock implementation of WebSocket for testing
 * Simulates WebSocket behavior without making real network connections
 */
// Create a proper class extending EventEmitter
class MockWebSocketBase extends EventEmitter {
  url: string;
  options: object;
  readyState: number;
  sentMessages: string[];
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;

  constructor(url: string, options: object = {}) {
    super();
    
    this.url = url;
    this.options = options;
    this.readyState = WS_CONNECTING;
    this.sentMessages = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;

    // Use setTimeout instead of process.nextTick to ensure event listeners are setup
    setTimeout(() => {
      this.readyState = WS_OPEN;
      // Emit event for EventEmitter style - THIS IS THE KEY FOR NODE.JS IMPLEMENTATION
      this.emit('open');
      
      // Call callback for callback style - THIS IS FOR BROWSER IMPLEMENTATION
      if (this.onopen) {
        this.onopen({ target: this });
      }
    }, 0);
  }

  send(data: string): boolean {
    if (this.readyState !== WS_OPEN) {
      throw new Error("WebSocket is not open");
    }

    this.sentMessages.push(data);

    try {
      const message = JSON.parse(data);
      if (message.action === "subscribe" && message.channel) {
        setTimeout(() => {
          this.mockReceive({
            status: "success",
            action: "subscribe",
            channel: message.channel,
          });
        }, 0);
      }
    } catch (e) {
      // Not a JSON message, ignore
    }

    return true;
  }

  close(code = 1000, reason = "Normal closure"): void {
    if (this.readyState === WS_CLOSED) return;
    
    this.readyState = WS_CLOSING;
    
    setTimeout(() => {
      this.readyState = WS_CLOSED;
      
      const closeEvent = {
        code,
        reason,
        wasClean: true,
        target: this,
      };
      
      // Emit event for EventEmitter style
      this.emit('close', code, Buffer.from(reason));
      
      // Call callback for callback style
      if (typeof this.onclose === "function") {
        this.onclose(closeEvent);
      }
    }, 0);
  }

  mockReceive(data: object): void {
    if (this.readyState !== WS_OPEN) return;
    
    const serializedData = JSON.stringify(data);
    
    // Emit event for EventEmitter style - For Node.js
    this.emit('message', Buffer.from(serializedData));
    
    // Call callback for callback style - For Browser
    if (typeof this.onmessage === "function") {
      const messageEvent = {
        data: serializedData,
        type: "message",
        target: this,
      };
      this.onmessage(messageEvent);
    }
  }

  mockError(error: Error): void {
    // Emit event for EventEmitter style - For Node.js
    this.emit('error', error);
    
    // Call callback for callback style - For Browser
    if (typeof this.onerror === "function") {
      const errorEvent = {
        error,
        message: error.message,
        type: "error",
        target: this,
      };
      this.onerror(errorEvent);
    }
    
    this.close(1006, error.message);
  }
}

// Create the mock constructor that returns our proper class
const MockWebSocket = jest.fn().mockImplementation(function(url: string, options: object = {}) {
  return new MockWebSocketBase(url, options);
});

// Add static properties
(MockWebSocket as any).CONNECTING = WS_CONNECTING;
(MockWebSocket as any).OPEN = WS_OPEN;
(MockWebSocket as any).CLOSING = WS_CLOSING;
(MockWebSocket as any).CLOSED = WS_CLOSED;

// Make the prototype functions available (for testing and instanceof checks)
MockWebSocket.prototype = MockWebSocketBase.prototype;

// Type assertion to add static properties to the mock
const MockWebSocketWithStatics = MockWebSocket as unknown as {
  new (url: string, options?: object): MockWebSocketInstance;
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
  prototype: MockWebSocketInstance;
};

// Export the mock with proper typing
module.exports = MockWebSocketWithStatics;
export default MockWebSocketWithStatics;