// src/index.ts - Facade pattern

// Import implementation types (use .js extension as they will be compiled)
// We use dynamic imports/requires inside the constructor based on environment
import type _SocketnestNodeImpl from './node';
import type _SocketnestBrowserImpl from './browser';
import type Channel from './channel';

// Define expected options structure for the public API
interface SocketnestOptions {
	wsUrl?: string;
	skipConnect?: boolean;
	// Add other potential options here
}

// Define the Public Facade Class
class Socketnest {
	// Internal implementation instance - type can be Node or Browser
	private _impl: _SocketnestNodeImpl | _SocketnestBrowserImpl;

	constructor(appId: number, key: string, options: SocketnestOptions = {}) {
		let ImplementationClass: typeof _SocketnestNodeImpl | typeof _SocketnestBrowserImpl;
		let isNodeEnvironment = false;

		// 1. Determine Environment
		try {
			isNodeEnvironment = Object.prototype.toString.call(global.process) === '[object process]';
		} catch (e) {
			isNodeEnvironment = false;
		}

		// 2. Conditionally require the appropriate implementation CLASS
		if (isNodeEnvironment) {
			try {
				ImplementationClass = require('./node').default; // Access default export
			} catch (e) {
				console.error("Failed to load Socketnest Node implementation:", e);
				throw new Error("Socketnest Node implementation failed to load. Ensure 'ws' module is installed.");
			}
		} else {
			try {
				ImplementationClass = require('./browser').default; // Access default export
			} catch(e) {
				console.error("Failed to load Socketnest Browser implementation:", e);
				if (typeof WebSocket === 'undefined') {
					 throw new Error("WebSocket is not supported in this environment.");
				} else {
					throw new Error("Socketnest Browser implementation failed to load, despite WebSocket support.");
				}
			}
		}

		// 3. Instantiate the *chosen* implementation
		if (!ImplementationClass) {
			 throw new Error("Could not determine Socketnest implementation for this environment.");
		}
		this._impl = new ImplementationClass(appId, key, options);
	}

	// 4. Proxy methods to the internal implementation (_impl)
	// Add return types matching the implementation methods
	public subscribe(channelName: string): Promise<Channel> {
		return this._impl.subscribe(channelName);
	}

	public unsubscribe(channelName?: string): boolean {
		return this._impl.unsubscribe(channelName);
	}

	public disconnect(): boolean {
		return this._impl.disconnect();
	}

	public onGlobal(event: string, callback: (data: any) => void): this {
		// Need to cast _impl type explicitly if method returns 'this'
		(this._impl as any).onGlobal(event, callback);
		return this;
	}

	public offGlobal(event: string, callback?: (data: any) => void): this {
		(this._impl as any).offGlobal(event, callback);
		return this;
	}

	public isConnected(): boolean {
		return this._impl.isConnected();
	}

	public isSubscribed(channelName: string): boolean {
		return this._impl.isSubscribed(channelName);
	}

	public getChannel(channelName: string): Channel | null {
		return this._impl.getChannel(channelName);
	}

	public getSocket(): WebSocket | null { // Return type depends on environment, use base WebSocket
		 // Need explicit check or assertion because _impl type is a union
		 if (this._impl && this._impl.socket) {
			 // Cast might be needed if WebSocket types differ slightly (e.g., ws vs native)
			 return this._impl.socket as WebSocket;
		 }
		 return null;
	}

	 // Expose _connect if needed by tests (as added by user)
	 public connect(): Promise<WebSocket> {
		 // Similar typing challenges as getSocket
		return (this._impl as any)._connect();
	}
}

// 5. Export the Facade class using default export
export default Socketnest;
