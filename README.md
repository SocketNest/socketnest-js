# socketnest-js
![Tests](https://github.com/SocketNest/socketnest-js/actions/workflows/tests.yml/badge.svg)

SocketNest JS Client Library - A lightweight WebSocket client for connecting to SocketNest servers.

## Features

- Simple API for WebSocket connections
- Channel-based subscription model
- Event-driven messaging
- Support for both CommonJS and ES modules
- Lightweight with minimal dependencies

## Installation

```bash
# Using npm
npm install socketnest-js

# Using yarn
yarn add socketnest-js
```

## Usage

### CommonJS (Node.js)

```javascript
const Socketnest = require('socketnest-js');

// Initialize the library
const socketnest = new Socketnest(9508896, 'your-api-key');
```

### ES Modules (Modern JavaScript)

```javascript
import Socketnest from 'socketnest-js';

// Initialize the library
const socketnest = new Socketnest(9508896, 'your-api-key');
```

### Basic Example

```javascript
// Initialize with your App ID and API Key
const socketnest = new Socketnest(9508896, 'your-api-key');

// Subscribe to a channel
const channel = await socketnest.subscribe('my-channel');

// Listen for events on this channel
channel.on('message', (data) => {
  console.log('Received message:', data);
});

// Listen for global events
socketnest.onGlobal('disconnect', (data) => {
  console.log(`Disconnected with code ${data.code}: ${data.reason}`);
});

// Unsubscribe from a channel
socketnest.unsubscribe('my-channel');
// or
channel.unsubscribe();

// Disconnect completely
socketnest.disconnect();
```

## API Reference

### Socketnest Class

#### Constructor

```javascript
new Socketnest(appId, key, options)
```

- `appId` (number): Your SocketNest application ID
- `key` (string): Your SocketNest API key
- `options` (object, optional):
  - `wsUrl` (string): Custom WebSocket URL (default: 'wss://api.socketnest.com')
  - `skipConnect` (boolean): Whether to skip auto-connecting (default: false)

#### Methods

- `subscribe(channelName)`: Subscribe to a channel
- `unsubscribe(channelName)`: Unsubscribe from a channel (or all channels if no name provided)
- `isSubscribed(channelName)`: Check if subscribed to a channel
- `getChannel(channelName)`: Get a channel object
- `onGlobal(eventName, callback)`: Register global event listener
- `offGlobal(eventName, callback)`: Remove global event listener
- `disconnect()`: Disconnect from the server
- `isConnected()`: Check connection status

### Channel Class

#### Methods

- `on(eventName, callback)`: Register event listener
- `off(eventName, callback)`: Remove event listener
- `unsubscribe()`: Unsubscribe from this channel

## Development

### Testing

The library uses Jest for testing. Run the tests using the following commands:

```bash
# Run all tests
npm test
# or
yarn test

# Run tests in watch mode
npm run test:watch
# or
yarn test:watch

# Run tests with coverage
npm run test:coverage
# or
yarn test:coverage
```

## License

MIT
