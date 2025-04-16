// src/channel.ts - Shared Channel class

// Forward declaration for the main Socketnest interface/class
// This avoids circular dependencies if Channel needs to reference Socketnest types
interface ISocketnest { // Simple interface representing methods Channel calls
    unsubscribe(channelName: string): boolean;
}

class Channel {
	// Use private access modifiers for internal properties
	private socketnest: ISocketnest;
	private listeners: Map<string, Set<(data: any) => void>>;
	public readonly name: string;

	constructor(socketnest: ISocketnest, name: string) {
		this.socketnest = socketnest;
		this.name = name;
		this.listeners = new Map(); // Map of event -> Set<callback>
	}

	on(event: string, callback: (data: any) => void): this {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback); // Use non-null assertion
		return this;
	}

	off(event: string, callback?: (data: any) => void): this {
		if (!this.listeners.has(event)) {
			return this;
		}
		const eventListeners = this.listeners.get(event)!;
		if (callback) {
			eventListeners.delete(callback);
			if (eventListeners.size === 0) {
				this.listeners.delete(event);
			}
		} else {
			// Remove all listeners for this event if no specific callback provided
			this.listeners.delete(event);
		}
		return this;
	}

	unsubscribe(): boolean {
		// Delegates to the main instance's unsubscribe method
		return this.socketnest.unsubscribe(this.name);
	}

	// Make internal methods protected or private if appropriate
	_handleMessage(event: string, data: any): void {
		if (this.listeners.has(event)) {
			// Iterate safely over listeners
			const listeners = this.listeners.get(event)!;
			listeners.forEach(callback => {
				try {
					callback(data);
				} catch (error) {
					console.error(`Error in Channel '${this.name}' event listener for '${event}':`, error);
				}
			});
		}
	}
}

export default Channel; 