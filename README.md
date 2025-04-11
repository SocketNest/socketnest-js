# socketnest-js
SocketNest JS Client Library

## Installation

```bash
npm install socketnest-js
# or
yarn add socketnest-js
```

## Usage

```javascript
const Socketnest = require('socketnest-js');

// Initialize the library
const socketnest = new Socketnest('your-app-id', 'your-api-key');

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
channel.unsubscribe();

// Disconnect completely
socketnest.disconnect();
```

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
