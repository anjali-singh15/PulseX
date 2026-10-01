// In-process event bus used to push live updates to connected browsers (Server-Sent Events).
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

module.exports = bus;
