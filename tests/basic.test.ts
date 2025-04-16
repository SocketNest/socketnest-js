/**
 * Basic tests for Socketnest library
 */

// Place jest.mock BEFORE any imports
jest.mock("ws");

// Required module imports
import Socketnest from "../src/index"
import Channel from '../src/channel'
// Import the MockWebSocket class directly from the mock file
import MockWebSocket from "../__mocks__/ws" // Adjust path if needed
// Add constants since the mock object might not have them at compile time
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

describe("Socketnest Basic Tests", () => {
	let socketnest: Socketnest

	

	beforeEach(() => {
		// Create new instance with skipConnect to manually control connection
		socketnest = new Socketnest(9508896, "test-api-key", {
			skipConnect: true,
		})
		console.error = jest.fn()

		// Clear mock data
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Clean up after each test
		if (socketnest && (socketnest as any)._impl.socket) { // Check internal socket
			socketnest.disconnect()
		}

		// Clear global events on the internal implementation
		const impl = (socketnest as any)._impl
		if (impl && impl.events) {
			impl.events.clear()
		}
	})

	// Basic initialization test
	test("should initialize with the correct configuration", () => {
		const impl = (socketnest as any)._impl
		expect(impl.appId).toBe(9508896)
		expect(impl.key).toBe("test-api-key")
		expect(impl.wsUrl).toContain("wss://api.socketnest.com")
		expect(impl.channels).toBeInstanceOf(Map)
		expect(impl.events).toBeInstanceOf(Map)

		// Test custom wsUrl
		const customSocketnest = new Socketnest(9508896, "test-api-key", {
			wsUrl: "wss://custom.example.com",
			skipConnect: true,
		})
		const customImpl = (customSocketnest as any)._impl
		expect(customImpl.wsUrl).toContain("wss://custom.example.com")
	})

	// Connection test
	test("should connect successfully", async () => {
		// Cast return type of connect to the mock type
		const socket = await (socketnest as any)._impl._connect();
		
		expect(socket).toBeTruthy();
		expect(socket.readyState).toBe(OPEN);
		expect(socketnest.isConnected()).toBe(true);

		// Test that repeated calls return the same promise
		const impl = (socketnest as any)._impl;
		const initialPromise = impl.connectionPromise;
		const secondConnectionPromise = (socketnest as any)._impl._connect();
		expect(impl.connectionPromise).toBe(initialPromise);
		await secondConnectionPromise;
	}, 3000);

	// // Error handling test
	test("should handle connection errors", async () => {
		// Create an instance with a pending connection
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const MockWebSocketBase = Object.getPrototypeOf(socket).constructor;
  		expect(socket).toBeInstanceOf(MockWebSocketBase)

		const disconnectHandler = jest.fn()
		socketnest.onGlobal("disconnect", disconnectHandler)

		// Use the mock's error simulation method
		socket.mockError(new Error("Connection error"))

		// Wait for next tick to allow handlers to execute
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify the disconnect handler was called
		expect(disconnectHandler).toHaveBeenCalled()
		expect(disconnectHandler).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("Connection error") }))

		// Verify connection was cleaned up
		const impl = (socketnest as any)._impl
		expect(impl.socket).toBeNull()
		expect(impl.connectionPromise).toBeNull()
	})

	// // Channel subscription test
	test("should subscribe to a channel", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const channel: Channel = await socketnest.subscribe("test-channel")

		expect(channel).toBeTruthy()
		expect(channel.name).toBe("test-channel")
		expect(socketnest.isSubscribed("test-channel")).toBe(true)
		const impl = (socketnest as any)._impl
		expect(impl.channels.has("test-channel")).toBe(true)

		// Access sentMessages from the casted mock socket
		const lastMessage = JSON.parse(socket.sentMessages[0])
		expect(lastMessage.action).toBe("subscribe")
		expect(lastMessage.channel).toBe("test-channel")

		// Test that subscribing to the same channel returns the existing instance
		const channel2 = await socketnest.subscribe("test-channel")
		expect(channel2).toBe(channel)
	})

	// // Test subscription without channel name
	test("should throw error when subscribing without channel name", async () => {
		await (socketnest as any).connect()

		await expect(socketnest.subscribe("")).rejects.toThrow(
			"Channel name is required"
		)
		// Cannot pass null or undefined due to TypeScript types
		// await expect(socketnest.subscribe(null)).rejects.toThrow();
	})

	// // Channel unsubscription test
	test("should unsubscribe from a channel", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const channel = await socketnest.subscribe("test-channel")
		expect(socketnest.isSubscribed("test-channel")).toBe(true)

		const result = socketnest.unsubscribe("test-channel")

		expect(result).toBe(true)
		expect(socketnest.isSubscribed("test-channel")).toBe(false)
		const impl = (socketnest as any)._impl
		expect(impl.channels.has("test-channel")).toBe(false)

		// Access sentMessages from the casted mock socket
		expect(socket.sentMessages.length).toBeGreaterThanOrEqual(2)
		const lastMessage = JSON.parse(socket.sentMessages.pop()!) // Access from mock
		expect(lastMessage.action).toBe("unsubscribe")
		expect(lastMessage.channel).toBe("test-channel")

		// Try to unsubscribe from a non-existent channel
		const nonExistentResult = socketnest.unsubscribe("non-existent")
		expect(nonExistentResult).toBe(false)
	})

	// Test unsubscribing from all channels
	test("should unsubscribe from all channels", async () => {
		await (socketnest as any).connect()

		// Subscribe to multiple channels
		const channel1 = await socketnest.subscribe("channel-1")
		const channel2 = await socketnest.subscribe("channel-2")

		const impl = (socketnest as any)._impl
		expect(impl.channels.size).toBe(2)

		// Unsubscribe from all
		const result = socketnest.unsubscribe()

		expect(result).toBe(true)
		expect(impl.channels.size).toBe(0)
		expect(socketnest.isSubscribed("channel-1")).toBe(false)
		expect(socketnest.isSubscribed("channel-2")).toBe(false)
	})

	// Event listening test
	test("should handle channel events correctly", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const channel = await socketnest.subscribe("test-channel")

		const callback = jest.fn()
		channel.on("test-event", callback)

		// Use mock's receive method
		socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Hello, world!" },
		})

		// Wait for the next tick to ensure event is processed
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify the callback was called with the correct data
		expect(callback).toHaveBeenCalledTimes(1)
		expect(callback).toHaveBeenCalledWith({ message: "Hello, world!" })

		// Test removing event listener
		channel.off("test-event", callback)

		// Send another message
		socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Hello again!" },
		})

		// Should still be called only once
		expect(callback).toHaveBeenCalledTimes(1)
	})

	// Error handling in channel events
	test("should handle errors in channel event callbacks", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const channel = await socketnest.subscribe("test-channel")

		// Mock console.error to prevent test output pollution
		const originalConsoleError = console.error
		console.error = jest.fn()

		// Create callback that throws an error
		const callbackThatThrows = jest.fn().mockImplementation(() => {
			throw new Error("Test error in callback")
		})

		// Create a normal callback to ensure other callbacks still run
		const normalCallback = jest.fn()

		// Register both callbacks
		channel.on("test-event", callbackThatThrows)
		channel.on("test-event", normalCallback)

		// Trigger the event
		socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Error test" },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// Error should be caught and logged
		expect(console.error).toHaveBeenCalled()

		// Both callbacks should be called
		expect(callbackThatThrows).toHaveBeenCalled()
		expect(normalCallback).toHaveBeenCalled()

		// Restore console.error
		console.error = originalConsoleError
	})

	// Test removing all event listeners
	test("should remove all listeners for a specific event", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const channel = await socketnest.subscribe("test-channel")

		const callback1 = jest.fn()
		const callback2 = jest.fn()

		channel.on("test-event", callback1)
		channel.on("test-event", callback2)

		// Remove all listeners for the event
		channel.off("test-event")

		// Trigger the event
		socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Should not be received" },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// No callbacks should be called
		expect(callback1).not.toHaveBeenCalled()
		expect(callback2).not.toHaveBeenCalled()
	})

	// Global event test
	test("should handle global events", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const callback = jest.fn()
		socketnest.onGlobal("global-test", callback)

		// Simulate an event that should trigger the global handler
		socket.mockReceive({
			event: "global-test",
			data: { value: 42 },
		})

		// Wait for the next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify callback was called
		expect(callback).toHaveBeenCalledTimes(1)
		expect(callback).toHaveBeenCalledWith({ value: 42 })

		// Test removing global event listener
		socketnest.offGlobal("global-test", callback)

		// Send another event
		socket.mockReceive({
			event: "global-test",
			data: { value: 43 },
		})

		// Should still be called only once
		expect(callback).toHaveBeenCalledTimes(1)
	})

	// Test removing all global event listeners
	test("should remove all global listeners for an event", async () => {
		await (socketnest as any).connect()

		// Cast the result of getSocket to our MockWebSocket type
		const socket = (socketnest as any).getSocket()
		const callback1 = jest.fn()
		const callback2 = jest.fn()

		socketnest.onGlobal("global-remove", callback1)
		socketnest.onGlobal("global-remove", callback2)

		// Remove all listeners
		socketnest.offGlobal("global-remove")

		// Trigger event
		socket.mockReceive({
			event: "global-remove",
			data: { value: 99 },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// No callbacks should be called
		expect(callback1).not.toHaveBeenCalled()
		expect(callback2).not.toHaveBeenCalled()
	})

	// Error handling in global events
	test("should handle errors in global event callbacks", async () => {
		await (socketnest as any).connect()

		// Mock console.error
		const originalConsoleError = console.error
		

		// Create a callback that throws
		const callbackThatThrows = jest.fn().mockImplementation(() => {
			throw new Error("Test error in global callback")
		})

		// Create a normal callback to ensure other callbacks still run
		const normalCallback = jest.fn()

		// Register both callbacks
		socketnest.onGlobal("global-error", callbackThatThrows)
		socketnest.onGlobal("global-error", normalCallback)

		// Cast socket to MockWebSocket before calling mockReceive
		const socket = (socketnest as any).getSocket()
		socket?.mockReceive({
			event: "global-error",
			data: { info: "trigger error" }
		})
		await new Promise((resolve) => process.nextTick(resolve))

		// Error should be caught and logged
		expect(console.error).toHaveBeenCalled()

		// Both callbacks should be called
		expect(callbackThatThrows).toHaveBeenCalled()
		expect(normalCallback).toHaveBeenCalled()

		// Restore console.error
		console.error = originalConsoleError
	})

	

	// Disconnection test
	test("should disconnect properly", async () => {
		await (socketnest as any).connect()

		expect(socketnest.isConnected()).toBe(true)

		const result = socketnest.disconnect()

		expect(result).toBe(true)
		const impl = (socketnest as any)._impl
		expect(impl.socket).toBeNull()
		expect(impl.connectionPromise).toBeNull()
	})

	// Utility methods tests
	test("should provide utility methods", async () => {
		await (socketnest as any).connect()

		// Test channel related methods
		expect(socketnest.isConnected()).toBe(true)
		expect(socketnest.isSubscribed("test-channel")).toBe(false)

		// Subscribe to a channel
		const channel = await socketnest.subscribe("test-channel")

		// Test getChannel method
		expect(socketnest.getChannel("test-channel")).toBe(channel)
		expect(socketnest.getChannel("non-existent")).toBeNull()
	})
})
