// src/node.ts - Node.js specific implementation
import WebSocket from 'ws'; // Use import
import Channel from './channel'; // Import shared Channel

// Define expected options structure
interface SocketnestOptions {
    wsUrl?: string;
    skipConnect?: boolean;
    // Add other potential options here
}

// Define structure for event data
interface EventData {
    channel?: string;
    [key: string]: any; // Allow other properties
}

// Define structure for disconnect data
interface DisconnectData {
    code: number;
    reason: string;
}

class _SocketnestNodeImpl {
	// Add types to properties
	private appId: number;
	private key: string;
	private options: SocketnestOptions;
	private wsUrl: string;
	private channels: Map<string, Channel>;
	private events: Map<string, Set<(data: any) => void>>; // Specify callback signature
	private connectionPromise: Promise<WebSocket> | null;
	public socket: WebSocket | null; // Make public if getSocket needs it

	constructor(appId: number, key: string, options: SocketnestOptions = {}) {
		this.appId = appId;
		this.key = key;
		this.options = options;
		this.wsUrl = options.wsUrl || "wss://api.socketnest.com";
		this.channels = new Map<string, Channel>(); // Use generics
		this.events = new Map<string, Set<(data: any) => void>>(); // Use generics
		this.connectionPromise = null;
		this.socket = null;

		if (!options.skipConnect) {
			this._connect();
		}
	}

	_connect(): Promise<WebSocket> {
		if (this.connectionPromise) {
			return this.connectionPromise;
		}
		this.connectionPromise = new Promise<WebSocket>((resolve, reject) => {
			try {
				const socketOptions = {
					headers: {
						"x-app-id": this.appId,
						"x-key": this.key,
						"x-channel": "",
					},
				};
				this.socket = new WebSocket(this.wsUrl, socketOptions);

				this.socket.on('open', () => {
					this.socket!.on('message', (data: Buffer) => { // Type the incoming data
						try {
                            const message = JSON.parse(data.toString());
							const channelName: string = message.channel || "";
							if (channelName && this.channels.has(channelName)) {
								const channel = this.channels.get(channelName)!;
								channel._handleMessage(message.event, message.data);
								this._triggerEvent(message.event, { channel: channelName, data: message.data });
							} else {
								this._triggerEvent(message.event, message.data);
							}
						} catch (error) {
							console.error("Error parsing message:", error instanceof Error ? error.message : error);
						}
					});
					resolve(this.socket!);
				});

				this.socket.on('error', (error: Error & { code?: number }) => {
					console.error("Error connecting to socketnest (Node):", error.message);
                    if (this.connectionPromise) {
					    reject(error);
                        this.connectionPromise = null;
                        this.socket = null;
                    }
                    this._triggerEvent("disconnect", { code: error.code || 1006, reason: error.message } as DisconnectData);
				});

				this.socket.on('close', (code: number, reason: Buffer) => {
                    const reasonString = reason ? reason.toString() : 'Connection closed';
					this.connectionPromise = null;
					this.socket = null;
					this._triggerEvent("disconnect", { code: code, reason: reasonString } as DisconnectData);
				});

			} catch (error) {
				console.error("WebSocket connection error (Node):", error instanceof Error ? error.message : error);
				this.connectionPromise = null;
				reject(error);
			}
		});
		return this.connectionPromise;
	}

	async subscribe(channelName: string): Promise<Channel> {
		if (!channelName) throw new Error("Channel name is required for subscription");
		const channelKey = String(channelName);
		if (this.channels.has(channelKey)) return this.channels.get(channelKey)!;

		await this._connect();
		const channel = new Channel(this, channelKey);
		this.channels.set(channelKey, channel);
		try {
			const subscribeMsg = JSON.stringify({
				action: "subscribe",
				channel: channelKey,
			});
			this.socket!.send(subscribeMsg); // Use non-null assertion
			return channel;
		} catch (error) {
			console.error(`Error subscribing to channel '${channelKey}' (Node):`, error instanceof Error ? error.message : error);
			this.channels.delete(channelKey);
			throw error;
		}
	}

	unsubscribe(channelName?: string): boolean { // Allow undefined for unsubscribing all
		if (!channelName) {
			for (const [channelKey] of this.channels.entries()) {
				if (this.socket && this.socket.readyState === WebSocket.OPEN) {
					const unsubscribeMsg = JSON.stringify({ action: "unsubscribe", channel: channelKey });
					this.socket.send(unsubscribeMsg);
				}
			}
			this.channels.clear();
			return true;
		}
		const channelKey = String(channelName);
		if (this.channels.has(channelKey)) {
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				const unsubscribeMsg = JSON.stringify({ action: "unsubscribe", channel: channelKey });
				this.socket.send(unsubscribeMsg);
			}
			this.channels.delete(channelKey);
			return true;
		}
		return false;
	}

	disconnect(): boolean {
		this.unsubscribe(); // Unsubscribe all
		if (this.socket) {
            this.socket.removeAllListeners();
			this.socket.close();
			this.socket = null;
			this.connectionPromise = null;
		}
		return true;
	}

	onGlobal(event: string, callback: (data: any) => void): this {
		if (!this.events.has(event)) {
			this.events.set(event, new Set());
		}
		this.events.get(event)!.add(callback);
		return this;
	}

	offGlobal(event: string, callback?: (data: any) => void): this {
		if (!this.events.has(event)) return this;
        const eventListeners = this.events.get(event)!;
		if (callback) {
			eventListeners.delete(callback);
            if (eventListeners.size === 0) {
				this.events.delete(event);
			}
		} else {
			this.events.delete(event);
		}
		return this;
	}

	_triggerEvent(event: string, data: EventData | any): void {
		if (this.events.has(event)) {
            const listeners = this.events.get(event)!;
			listeners.forEach(callback => {
				try {
					callback(data);
				} catch (error) {
					console.error(`Error in global event listener for ${event}:`, error instanceof Error ? error.message : error);
				}
			});
		}
	}

	isConnected(): boolean {
		return !!this.socket && this.socket.readyState === WebSocket.OPEN;
	}

	isSubscribed(channelName: string): boolean {
		return this.channels.has(String(channelName));
	}

	getChannel(channelName: string): Channel | null {
		return this.channels.get(String(channelName)) || null;
	}
}

export default _SocketnestNodeImpl; // Use export default 