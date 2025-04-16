const WebSocket = require("ws")
class Channel {
	constructor(socketnest, name) {
		this.socketnest = socketnest
		this.name = name
		this.listeners = new Map() // Map of event -> Set<callback>
	}
	// Subscribe to events on this channel
	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}
		this.listeners.get(event).add(callback)
		return this
	}
	// Remove event listener
	off(event, callback) {
		if (!this.listeners.has(event)) {
			return this
		}
		if (callback) {
			this.listeners.get(event).delete(callback)
		} else {
			// Remove all listeners for this event
			this.listeners.delete(event)
		}
		return this
	}
	// Unsubscribe from this channel
	unsubscribe() {
		return this.socketnest.unsubscribe(this.name)
	}
	// Internal method to handle channel-specific messages
	_handleMessage(event, data) {
		if (this.listeners.has(event)) {
			for (const callback of this.listeners.get(event)) {
				try {
					callback(data)
				} catch (error) {
					console.error(
						`Error in event listener for ${event}:`,
						error,
					)
				}
			}
		}
	}
}
class Socketnest {
	constructor(appId, key, options = {}) {
		this.appId = appId
		this.key = key
		this.options = options
		this.wsUrl = options.wsUrl || "wss://api.socketnest.com"
		this.channels = new Map() // Map of channelName -> Channel instance
		this.events = new Map() // Global event listeners
		this.connectionPromise = null
		this.socket = null
		// Connect immediately on instantiation
		if (!options.skipConnect) {
			this._connect()
		}
	}
	// Internal method to establish the main connection
	_connect() {
		if (this.connectionPromise) {
			return this.connectionPromise
		}
		this.connectionPromise = new Promise((resolve, reject) => {
			// For Node.js, we need to set headers via options
			const socketOptions = {
				headers: {
					"x-app-id": this.appId,
					"x-key": this.key,
					"x-channel": "", // Empty channel for initial connection
				},
			}
			// Create WebSocket connection
			this.socket = new WebSocket(this.wsUrl, socketOptions)

			// Connection opened
			this.socket.onopen = () => {
				// Set up message handler
				this.socket.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data)
						// Extract channel from message if available
						const channelName = message.channel || ""
						if (channelName && this.channels.has(channelName)) {
							// If we have a specific channel, route the message there
							const channel = this.channels.get(channelName)
							channel._handleMessage(message.event, message.data)
							// Also trigger global event
							this._triggerEvent(message.event, {
								channel: channelName,
								data: message.data,
							})
						} else {
							// For messages without a channel, just trigger global event
							this._triggerEvent(message.event, message.data)
						}
					} catch (error) {
						console.error("Error parsing message:", error)
					}
				}
				resolve(this.socket)
			}
			// Connection error
			this.socket.onerror = (error) => {
				console.error("Error connecting to socketnest", error)
				reject(error)
			}
			// Handle disconnection
			this.socket.onclose = (event) => {
				this.connectionPromise = null
				this.socket = null
				// Trigger global disconnect event
				this._triggerEvent("disconnect", {
					code: event.code,
					reason: event.reason,
				})
			}
		})
		return this.connectionPromise
	}
	// Subscribe to a channel
	async subscribe(channelName) {
		if (!channelName) {
			throw new Error("Channel name is required for subscription")
		}
		const channelKey = String(channelName)
		// Check if we already have a subscription for this channel
		if (this.channels.has(channelKey)) {
			return this.channels.get(channelKey)
		}
		// Make sure we have a base connection first
		await this._connect()
		// Create a new Channel instance
		const channel = new Channel(this, channelKey)
		this.channels.set(channelKey, channel)
		try {
			// Send subscription message
			const subscribeMsg = JSON.stringify({
				action: "subscribe",
				channel: channelKey,
			})
			this.socket.send(subscribeMsg)

			return channel
		} catch (error) {
			console.error(`Error subscribing to channel: ${channelKey}`, error)
			this.channels.delete(channelKey)
			throw error
		}
	}
	// Unsubscribe from a channel
	unsubscribe(channelName) {
		if (!channelName) {
			// Unsubscribe from all channels
			for (const [channelKey] of this.channels.entries()) {
				if (this.socket && this.socket.readyState === WebSocket.OPEN) {
					const unsubscribeMsg = JSON.stringify({
						action: "unsubscribe",
						channel: channelKey,
					})
					this.socket.send(unsubscribeMsg)
				}
			}
			this.channels.clear()
			return true
		}
		const channelKey = String(channelName)
		if (this.channels.has(channelKey)) {
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				const unsubscribeMsg = JSON.stringify({
					action: "unsubscribe",
					channel: channelKey,
				})
				this.socket.send(unsubscribeMsg)
			}
			this.channels.delete(channelKey)
			return true
		}
		return false
	}
	// Completely disconnect from the service
	disconnect() {
		// Unsubscribe from all channels first
		this.unsubscribe()
		// Then close the socket
		if (this.socket) {
			this.socket.close()
			this.socket = null
			this.connectionPromise = null
		}
		return true
	}
	// Subscribe to global events
	onGlobal(event, callback) {
		if (!this.events.has(event)) {
			this.events.set(event, new Set())
		}
		this.events.get(event).add(callback)
		return this
	}
	// Remove global event listener
	offGlobal(event, callback) {
		if (!this.events.has(event)) {
			return this
		}
		if (callback) {
			this.events.get(event).delete(callback)
		} else {
			// Remove all listeners for this event
			this.events.delete(event)
		}
		return this
	}
	// Internal method to trigger global events
	_triggerEvent(event, data) {
		if (this.events.has(event)) {
			for (const callback of this.events.get(event)) {
				try {
					callback(data)
				} catch (error) {
					console.error(
						`Error in global event listener for ${event}:`,
						error,
					)
				}
			}
		}
	}
	// Check if connected to the main socket
	isConnected() {
		return this.socket && this.socket.readyState === WebSocket.OPEN
	}
	// Check if subscribed to a specific channel
	isSubscribed(channelName) {
		const channelKey = String(channelName)
		return this.channels.has(channelKey)
	}
	// Get a channel instance if it exists
	getChannel(channelName) {
		const channelKey = String(channelName)
		return this.channels.get(channelKey) || null
	}
}
module.exports = Socketnest
