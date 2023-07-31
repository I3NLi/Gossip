import net from 'net';
// import { Worker, isMainThread, parentPort } from 'worker_threads';
import {MESSAGETYPE} from './MessageType.mjs';

export default class GossipServer {
  constructor() {
    this.server = net.createServer();
    this.KnowClients = [];//{NetAddresse: {'socket':sockert, 'Abonnement':[]}'}
    this.UnKnowClients = [];
    this.server.on('connection', this.handleConnection.bind(this));
  }

  getNetAddresses(socket) {
    return socket.remoteAddress + ":" + socket.remotePort;
  }

  handleConnection(socket) {
    console.log('New client connected');
    const address = this.getNetAddresses(socket);

    const isKnownClient = this.KnowClients.some((client) => client.address === address);
    if (!isKnownClient) {
      this.KnowClients.push({ address, socket });
    }

    socket.on('data', (data) => {
      console.log(`Received data from client: ${data}`);
      // console.log(`Received data from client:`);
      // console.log(data.toString('hex'));

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
      console.log("\n")


      if(messageType.toString() == '500'){
        console.log(MESSAGETYPE[messageType]);
      }else if (messageType.toString() == '531'){
        console.log(MESSAGETYPE[messageType]);
      }

    });

    socket.on('end', () => {
      console.log('Client disconnected');
      this.removeClient(socket);
    });
  }

  broadcast(data, senderSocket) {
    this.KnowClients.forEach((client) => {
      if (client.socket !== senderSocket) {
        client.socket.write(data);
      }
    });
  }

  removeClient(socket) {
    const index = this.KnowClients.findIndex((client) => client.socket === socket);
    if (index !== -1) {
      this.KnowClients.splice(index, 1);
    }
  }

  start(port) {
    this.server.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  }
}


