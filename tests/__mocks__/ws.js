/**
 * Mock implementation of the ws library
 */
const EventEmitter = require("events")

/**
 * MockWebSocket - Mock implementation of WebSocket for testing
 * Simulates WebSocket behavior without making real network connections
 */
class MockWebSocket extends EventEmitter {
	// WebSocket connection states
	static CONNECTING = 0
	static OPEN = 1
	static CLOSING = 2
	static CLOSED = 3

	constructor(url, options = {}) {
		super()

		// Store connection parameters
		this.url = url
		this.options = options

		// Socket state
		this.readyState = MockWebSocket.CONNECTING

		// Track sent messages for testing
		this.sentMessages = []

		// Event callback properties (used in index.js)
		this.onopen = null
		this.onmessage = null
		this.onerror = null
		this.onclose = null

		// Immediately open the connection for testing
		process.nextTick(() => {
			this.readyState = MockWebSocket.OPEN

			// Handle both callback style and event emitter style
			this.emit("open")
			if (typeof this.onopen === "function") {
				this.onopen({ target: this })
			}
		})
	}

	/**
	 * Send data through the mock WebSocket
	 */
	send(data) {
		if (this.readyState !== MockWebSocket.OPEN) {
			throw new Error("WebSocket is not open")
		}

		// Store the message for test verification
		this.sentMessages.push(data)

		// Parse the message to see if we need to auto-respond
		try {
			const message = JSON.parse(data)

			// Auto-respond to subscription messages
			if (message.action === "subscribe" && message.channel) {
				process.nextTick(() => {
					this.mockReceive({
						status: "success",
						action: "subscribe",
						channel: message.channel,
					})
				})
			}
		} catch (e) {
			// Not a JSON message, ignore
		}

		return true
	}

	/**
	 * Close the mock WebSocket connection
	 */
	close(code = 1000, reason = "Normal closure") {
		if (this.readyState === MockWebSocket.CLOSED) {
			return
		}

		this.readyState = MockWebSocket.CLOSING

		process.nextTick(() => {
			this.readyState = MockWebSocket.CLOSED

			const closeEvent = {
				code,
				reason,
				wasClean: true,
				target: this,
			}

			// Handle both callback style and event emitter style
			this.emit("close", closeEvent)
			if (typeof this.onclose === "function") {
				this.onclose(closeEvent)
			}
		})
	}

	/**
	 * Helper method for tests to simulate receiving a message
	 */
	mockReceive(data) {
		if (this.readyState !== MockWebSocket.OPEN) {
			return
		}

		const messageEvent = {
			data: JSON.stringify(data),
			type: "message",
			target: this,
		}

		// Handle both callback style and event emitter style
		this.emit("message", messageEvent)
		if (typeof this.onmessage === "function") {
			this.onmessage(messageEvent)
		}
	}

	/**
	 * Helper method to simulate connection error
	 */
	mockError(error) {
		const errorEvent = {
			error,
			message: error.message,
			type: "error",
			target: this,
		}

		// Handle both callback style and event emitter style
		this.emit("error", errorEvent)
		if (typeof this.onerror === "function") {
			this.onerror(errorEvent)
		}

		// Connection errors should close the connection
		this.close(1006, error.message)
	}
}

// Export the mock implementation
module.exports = MockWebSocket
