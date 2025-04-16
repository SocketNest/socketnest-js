/**
 * Basic tests for Socketnest library
 */

// Required module imports
const Socketnest = require("../src/index")

// Automatically mock the ws module (will use our implementation in __mocks__)
jest.mock("ws")

// Import our mocked websocket to directly access it
const MockWebSocket = require("ws")

describe("Socketnest Basic Tests", () => {
	let socketnest

	beforeEach(() => {
		// Create new instance with skipConnect to manually control connection
		socketnest = new Socketnest(9508896, "test-api-key", {
			skipConnect: true,
		})

		// Clear mock data
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Clean up after each test
		if (socketnest && socketnest.socket) {
			socketnest.disconnect()
		}

		// Just to be safe, remove all listeners
		if (socketnest) {
			socketnest.events.clear()
		}
	})

	// Basic initialization test
	test("should initialize with the correct configuration", () => {
		expect(socketnest.appId).toBe(9508896)
		expect(socketnest.key).toBe("test-api-key")
		expect(socketnest.wsUrl).toBe("wss://api.socketnest.com")
		expect(socketnest.channels).toBeInstanceOf(Map)
		expect(socketnest.events).toBeInstanceOf(Map)

		// Test custom wsUrl
		const customSocketnest = new Socketnest(9508896, "test-api-key", {
			wsUrl: "wss://custom.example.com",
			skipConnect: true,
		})
		expect(customSocketnest.wsUrl).toBe("wss://custom.example.com")
	})

	// Connection test
	test("should connect successfully", async () => {
		const socket = await socketnest._connect()

		expect(socket).toBeTruthy()
		expect(socket).toBeInstanceOf(MockWebSocket)
		expect(socket.readyState).toBe(MockWebSocket.OPEN)
		expect(socketnest.isConnected()).toBe(true)

		// Test that repeated calls return the same promise
		const secondConnectionPromise = socketnest._connect()
		expect(secondConnectionPromise).toBe(socketnest.connectionPromise)
	})

	// Error handling test
	test("should handle connection errors", async () => {
		// Create an instance with a pending connection
		await socketnest._connect()

		// Set up a disconnect handler
		const disconnectHandler = jest.fn()
		socketnest.onGlobal("disconnect", disconnectHandler)

		// Instead of creating an error, just directly test the socket close handling
		socketnest.socket.close(1006, "Connection error")

		// Wait for next tick to allow handlers to execute
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify the disconnect handler was called
		expect(disconnectHandler).toHaveBeenCalled()
		expect(disconnectHandler).toHaveBeenCalledWith({
			code: 1006,
			reason: "Connection error",
		})

		// Verify connection was cleaned up
		expect(socketnest.socket).toBeNull()
		expect(socketnest.connectionPromise).toBeNull()
	})

	// Channel subscription test
	test("should subscribe to a channel", async () => {
		await socketnest._connect()

		const channel = await socketnest.subscribe("test-channel")

		expect(channel).toBeTruthy()
		expect(channel.name).toBe("test-channel")
		expect(socketnest.channels.has("test-channel")).toBe(true)
		expect(socketnest.isSubscribed("test-channel")).toBe(true)

		// Verify the subscription message was sent
		const lastMessage = JSON.parse(socketnest.socket.sentMessages[0])
		expect(lastMessage.action).toBe("subscribe")
		expect(lastMessage.channel).toBe("test-channel")

		// Test that subscribing to the same channel returns the existing instance
		const channel2 = await socketnest.subscribe("test-channel")
		expect(channel2).toBe(channel)
	})

	// Test subscription without channel name
	test("should throw error when subscribing without channel name", async () => {
		await socketnest._connect()

		await expect(socketnest.subscribe()).rejects.toThrow(
			"Channel name is required",
		)
		await expect(socketnest.subscribe("")).rejects.toThrow(
			"Channel name is required",
		)
		await expect(socketnest.subscribe(null)).rejects.toThrow(
			"Channel name is required",
		)
	})

	// Channel unsubscription test
	test("should unsubscribe from a channel", async () => {
		await socketnest._connect()

		const channel = await socketnest.subscribe("test-channel")
		expect(socketnest.isSubscribed("test-channel")).toBe(true)

		const result = socketnest.unsubscribe("test-channel")

		expect(result).toBe(true)
		expect(socketnest.isSubscribed("test-channel")).toBe(false)
		expect(socketnest.channels.has("test-channel")).toBe(false)

		// Verify the unsubscribe message was sent
		const lastMessage = JSON.parse(socketnest.socket.sentMessages[1])
		expect(lastMessage.action).toBe("unsubscribe")
		expect(lastMessage.channel).toBe("test-channel")

		// Try to unsubscribe from a non-existent channel
		const nonExistentResult = socketnest.unsubscribe("non-existent")
		expect(nonExistentResult).toBe(false)
	})

	// Test unsubscribing from all channels
	test("should unsubscribe from all channels", async () => {
		await socketnest._connect()

		// Subscribe to multiple channels
		const channel1 = await socketnest.subscribe("channel-1")
		const channel2 = await socketnest.subscribe("channel-2")

		expect(socketnest.channels.size).toBe(2)

		// Unsubscribe from all
		const result = socketnest.unsubscribe()

		expect(result).toBe(true)
		expect(socketnest.channels.size).toBe(0)
		expect(socketnest.isSubscribed("channel-1")).toBe(false)
		expect(socketnest.isSubscribed("channel-2")).toBe(false)
	})

	// Event listening test
	test("should handle channel events correctly", async () => {
		await socketnest._connect()

		const channel = await socketnest.subscribe("test-channel")

		const callback = jest.fn()
		channel.on("test-event", callback)

		// Use our mock to simulate receiving a message
		socketnest.socket.mockReceive({
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
		socketnest.socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Hello again!" },
		})

		// Should still be called only once
		expect(callback).toHaveBeenCalledTimes(1)
	})

	// Error handling in channel events
	test("should handle errors in channel event callbacks", async () => {
		await socketnest._connect()

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
		socketnest.socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Hello, world!" },
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
		await socketnest._connect()

		const channel = await socketnest.subscribe("test-channel")

		const callback1 = jest.fn()
		const callback2 = jest.fn()

		channel.on("test-event", callback1)
		channel.on("test-event", callback2)

		// Remove all listeners for the event
		channel.off("test-event")

		// Trigger the event
		socketnest.socket.mockReceive({
			channel: "test-channel",
			event: "test-event",
			data: { message: "Hello, world!" },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// No callbacks should be called
		expect(callback1).not.toHaveBeenCalled()
		expect(callback2).not.toHaveBeenCalled()
	})

	// Global event test
	test("should handle global events", async () => {
		await socketnest._connect()

		const callback = jest.fn()
		socketnest.onGlobal("test-event", callback)

		// Simulate an event that should trigger the global handler
		socketnest.socket.mockReceive({
			event: "test-event",
			data: { value: 42 },
		})

		// Wait for the next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify callback was called
		expect(callback).toHaveBeenCalledTimes(1)
		expect(callback).toHaveBeenCalledWith({ value: 42 })

		// Test removing global event listener
		socketnest.offGlobal("test-event", callback)

		// Send another event
		socketnest.socket.mockReceive({
			event: "test-event",
			data: { value: 43 },
		})

		// Should still be called only once
		expect(callback).toHaveBeenCalledTimes(1)
	})

	// Test removing all global event listeners
	test("should remove all global listeners for an event", async () => {
		await socketnest._connect()

		const callback1 = jest.fn()
		const callback2 = jest.fn()

		socketnest.onGlobal("test-event", callback1)
		socketnest.onGlobal("test-event", callback2)

		// Remove all listeners
		socketnest.offGlobal("test-event")

		// Trigger event
		socketnest.socket.mockReceive({
			event: "test-event",
			data: { value: 42 },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// No callbacks should be called
		expect(callback1).not.toHaveBeenCalled()
		expect(callback2).not.toHaveBeenCalled()
	})

	// Error handling in global events
	test("should handle errors in global event callbacks", async () => {
		await socketnest._connect()

		// Mock console.error
		const originalConsoleError = console.error
		console.error = jest.fn()

		// Create a callback that throws
		const callbackThatThrows = jest.fn().mockImplementation(() => {
			throw new Error("Test error in global callback")
		})

		// Register callback
		socketnest.onGlobal("test-event", callbackThatThrows)

		// Trigger event
		socketnest.socket.mockReceive({
			event: "test-event",
			data: { value: 42 },
		})

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// Error should be caught and logged
		expect(console.error).toHaveBeenCalled()
		expect(callbackThatThrows).toHaveBeenCalled()

		// Restore console.error
		console.error = originalConsoleError
	})

	// Connection close test
	test("should handle connection close events", async () => {
		await socketnest._connect()

		// Setup callback for disconnect event
		const callback = jest.fn()
		socketnest.onGlobal("disconnect", callback)

		// Simulate connection close
		socketnest.socket.close(1000, "Test close")

		// Wait for next tick
		await new Promise((resolve) => process.nextTick(resolve))

		// Verify callback was called with close info
		expect(callback).toHaveBeenCalledWith({
			code: 1000,
			reason: "Test close",
		})

		// Verify socket and promise were cleared
		expect(socketnest.socket).toBeNull()
		expect(socketnest.connectionPromise).toBeNull()
	})

	// Disconnection test
	test("should disconnect properly", async () => {
		await socketnest._connect()

		expect(socketnest.isConnected()).toBe(true)

		const result = socketnest.disconnect()

		expect(result).toBe(true)
		expect(socketnest.socket).toBeNull()
		expect(socketnest.connectionPromise).toBeNull()
	})

	// Utility methods tests
	test("should provide utility methods", async () => {
		await socketnest._connect()

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
