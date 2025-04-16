// src/browser.ts - Browser specific implementation
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

class _SocketnestBrowserImpl {
    // Add types to properties
    private appId: number;
    private key: string;
    private options: SocketnestOptions;
    private wsUrl: string;
    private channels: Map<string, Channel>;
    private events: Map<string, Set<(data: any) => void>>;
    private connectionPromise: Promise<WebSocket> | null;
    public socket: WebSocket | null;

	constructor(appId: number, key: string, options: SocketnestOptions = {}) {
		this.appId = appId;
		this.key = key;
		this.options = options;
        const baseUrl = options.wsUrl || "wss://api.socketnest.com";
        const url = new URL(baseUrl);
        url.searchParams.set('appId', String(this.appId)); // Ensure string
        url.searchParams.set('key', this.key);
        this.wsUrl = url.toString();

		this.channels = new Map<string, Channel>();
		this.events = new Map<string, Set<(data: any) => void>>();
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
				if (typeof WebSocket === 'undefined') {
                    throw new Error("Native WebSocket not supported in this environment.");
                }
				this.socket = new WebSocket(this.wsUrl);

				this.socket.onopen = () => {
					this.socket!.onmessage = (event: MessageEvent) => {
						try {
							const message = JSON.parse(event.data);
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
					};
					resolve(this.socket!);
				};

				this.socket.onerror = (event: Event) => {
					console.error("Error connecting to socketnest (Browser)");
                    const error = new Error("WebSocket connection failed");
                    if (this.connectionPromise) {
					    reject(error);
                        this.connectionPromise = null;
                        this.socket = null;
                    }
                    this._triggerEvent("disconnect", { code: 1006, reason: "Connection error" } as DisconnectData);
				};

				this.socket.onclose = (event: CloseEvent) => {
					this.connectionPromise = null;
					this.socket = null;
					this._triggerEvent("disconnect", { code: event.code, reason: event.reason || "Connection closed" } as DisconnectData);
				};

			} catch (error) {
				console.error("WebSocket connection error (Browser):", error instanceof Error ? error.message : error);
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
			this.socket!.send(subscribeMsg);
			return channel;
		} catch (error) {
			console.error(`Error subscribing to channel '${channelKey}' (Browser):`, error instanceof Error ? error.message : error);
			this.channels.delete(channelKey);
			throw error;
		}
	}

	unsubscribe(channelName?: string): boolean {
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
        this.unsubscribe();
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onmessage = null;
            this.socket.onerror = null;
            this.socket.onclose = null;
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

export default _SocketnestBrowserImpl; // Use export default