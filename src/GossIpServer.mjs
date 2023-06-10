import net from 'net';
// import { Worker, isMainThread, parentPort } from 'worker_threads';
import { MESSAGETYPE } from './MessageType.mjs';
// This class is for the GossipServer, who will process the connection of the other peers.
export default class GossipServer {
  constructor() {
    // Create a TCP server instance
    this.server = net.createServer();
    // Array to store known clients
    this.KnowClients = [];
    // Array to store unknown clients
    this.UnKnowClients = [];
    // Bind the connection event handler to handle new client connections
    this.server.on('connection', this.handleConnection.bind(this));
  }

  getNetAddresses(socket) {
    // Get the network address of a socket
    return socket.remoteAddress + ':' + socket.remotePort;
  }

  handleConnection(socket) {
    console.log('New client connected');
    const address = this.getNetAddresses(socket);

    // Check if the client is already known
    const isKnownClient = this.KnowClients.some((client) => client.address === address);
    if (!isKnownClient) {
      // Add the new client to the known clients list
      this.KnowClients.push({ address, socket });
    }

    socket.on('data', (data) => {
      console.log(`Received data from client: ${data}`);

      // Parse the received message
      const size = data.readUInt16BE(0);
      const messageType = data.readUInt16BE(2);
      const ttl = data.readUInt8(4);
      const reserved = data.readUInt8(5);
      const dataType = data.readUInt16BE(6);
      const messageData = data.slice(8);

      console.log(`Message Size: ${size}`);
      console.log(`Message Type: ${messageType}`);
      console.log(`TTL: ${ttl}`);
      console.log(`Reserved: ${reserved}`);
      console.log(`Data Type: ${dataType}`);
      console.log(`Message Data: ${messageData.toString()}`);
      console.log('\n');

      // Handle different message types
      if (messageType.toString() === '500') {
        console.log(MESSAGETYPE[messageType]);
        // TODO: Handle message type 500
      } else if (messageType.toString() === '531') {
        console.log(MESSAGETYPE[messageType]);
        // TODO: Handle message type 531
      }
    });

    socket.on('end', () => {
      console.log('Client disconnected');
      this.removeClient(socket);
    });
  }

  broadcast(data, senderSocket) {
    // Broadcast the data to all known clients except the sender
    this.KnowClients.forEach((client) => {
      if (client.socket !== senderSocket) {
        client.socket.write(data);
      }
    });
  }

  removeClient(socket) {
    // Remove a client from the known clients list
    const index = this.KnowClients.findIndex((client) => client.socket === socket);
    if (index !== -1) {
      this.KnowClients.splice(index, 1);
    }
  }

  start(port) {
    // Start the server and listen on the specified port
    this.server.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  }
}
