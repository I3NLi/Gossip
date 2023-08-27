import * as net from 'net';
import { MESSAGETYPE } from './MessageType';

export default class GossipServer {
  /* Shared */
  // store the cache of the messages
  private Cache: any = {};
  private InternServer: net.Server;
  private ExternServer: net.Server;

  /* Intern Only */
  // store the subscribed topics relation with socket
  private Topics: { [dataType: string]: net.Socket[] } = {};

  /* Extern Only */
  // private Peer: []] = [];

  constructor(internPort = 7001, externPort = 4000) {
    // Create internal and external servers
    this.InternServer = net.createServer();
    this.ExternServer = net.createServer();

    // Listen on specified ports
    this.InternServer.listen(internPort);
    // this.ExternServer.listen(externPort);

    // Set up event handlers for internal and external connections
    this.InternServer.on('connection', this.handleInternConnection.bind(this));
    this.ExternServer.on('connection', this.handleExternConnection.bind(this));
    console.log('GossipServer created');
  }

  /** Intern Only */
  private handleInternConnection(socket: net.Socket) {
    // Handle Connection from internal clients(other modules)
    console.log('New internClient connected from ' + this.getNetAddresses(socket));

    socket.on('data', (data: Buffer) => {
      console.log(`Received data from internClient client: ${this.getNetAddresses(socket)}`);

      //Read Header of the message
      const size = data.readUInt16BE(0);
      const messageType = data.readUInt16BE(2);

      console.log(`Message Size: ${size}`);
      console.log(`Message Type: ${messageType} ${MESSAGETYPE[messageType.toString()]}`);

      // Dispatch message to corresponding handler
      if (MESSAGETYPE[messageType.toString()] === 'GOSSIP ANNOUNCE') {
        this.handleAnnounce(data);
      } else if (MESSAGETYPE[messageType.toString()] === 'GOSSIP NOTIFY') {
        this.handleNotify(data, socket);
      } else if (MESSAGETYPE[messageType.toString()] === 'GOSSIP VALIDATION') {
        this.handleValidation(data);
      }
    });

    // Remove the socket from the topics when the client disconnects
    socket.on('end', () => {
      console.log(`internClient ${this.getNetAddresses(socket)} disconnected `);
      Object.keys(this.Topics).forEach((topic) => {
        const index = this.Topics[topic].findIndex((client) => client === socket);
        if (index !== -1) {
          this.Topics[topic].splice(index, 1);
        }
      });
      console.log('Client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(err);
    });
  }
  /**
   * To handle the announcement request.
   * @param data The message received.
   */
  private handleAnnounce(data: Buffer) {
    // Extract Time-to-Live (TTL) value from the data starting at index 4 with a length of 1 byte.
    // The TTL field specifies until how many hops the overlying application requires this data
    // to be spread.
    const ttl = data.readUIntBE(4, 1);

    // Extract the reserved field from the data starting at index 5 with a length of 1 byte.
    const reserved = data.readUIntBE(5, 1);

    // Extract the data type from the data starting at index 6 using 2 bytes (UInt16).
    const dataType = data.readUInt16BE(6);

    // Extract the message data from the data starting at index 8 to the end of the array.
    const messageData = data.subarray(8);

    // Display extracted values with explanatory messages.
    console.log(`TTL: ${ttl}`);
    console.log(`Reserved: ${reserved}`);
    console.log(`Data Type: ${dataType}`);
    console.log(`Message Data: ${messageData.toString()}`);
    console.log('\n');

  }

  /**
 * Handles the incoming notification message.
 * @param {Buffer} data - The incoming message data.
 * @param {net.Socket} socket - The socket associated with the incoming message.
 */
private handleNotify(data: Buffer, socket: net.Socket) {
  // Extract reserved field from the data using 2 bytes (UInt16).
  const reserved = data.readUInt16BE(4);

  // Extract data type from the data using 2 bytes (UInt16).
  const dataType = data.readUInt16BE(6);

  // Check if the topic array for this data type exists, and create it if not.
  if (this.Topics[dataType] === undefined) {
    this.Topics[dataType] = [];
  }

  // Add the socket to the list of sockets interested in this data type.
  if (this.Topics[dataType].includes(socket)) {
    console.error('Socket already in topic');
  } else {
    this.Topics[dataType].push(socket);
  }

  // Display extracted values for logging or debugging.
  console.log(`Reserved: ${reserved}`);
  console.log(`Data Type: ${dataType}`);
}



  /** Extern Only */
  private handleExternConnection(socket: net.Socket) {
    /**TODO
     * 
     * 
     */

    const address = this.getNetAddresses(socket);
    console.log('New externClient connected from ' + address);
    

    socket.on('data', (data: Buffer) => {
      console.log(`Received data from internClient client: ${data}`);

      //Read Header of the message
      const size = data.readUInt16BE(0);
      const messageType = data.readUInt16BE(2);

      console.log(`Message Size: ${size}`);
      console.log(`Message Type: ${messageType} ${MESSAGETYPE[messageType.toString()]}`);

      // Dispatch message to corresponding handler
      if (MESSAGETYPE[messageType.toString()] === 'GOSSIP ANNOUNCE') {
        this.handleAnnounce(data);
      } else if (MESSAGETYPE[messageType.toString()] === 'GOSSIP NOTIFY') {
        this.handleNotify(data, socket);
      } else if (MESSAGETYPE[messageType.toString()] === 'GOSSIP VALIDATION') {
        this.handleValidation(data);
      }
    });

    // Remove the socket from the topics when the client disconnects
    socket.on('end', () => {
      console.log(`internClient ${this.getNetAddresses(socket)} disconnected `);
      Object.keys(this.Topics).forEach((topic) => {
        const index = this.Topics[topic].findIndex((client) => client === socket);
        if (index !== -1) {
          this.Topics[topic].splice(index, 1);
        }
      });
      console.log('Client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
      console.error(err);
    });
  }

  /** Shared */
  private broadcast(messageID: Buffer) {

  }

  private removeClient(socket: net.Socket) {

  }

  private handleErrorMesssage(messageID: Buffer) { };

  private sendNotification(messageID: Buffer, dataType: Buffer, data: Buffer) {
    /** TODO:
     * This message is sent by Gossip to the module which has previously asked Gossip to notify
     * when a message of a particular data type is received by Gossip. The receiver should have
     * previously conveyed its interest using GOSSIP NOTIFY message.
     * Message ID is a random number to identify this message and its corresponding response.
     * 
     * The module receiving this message has to reply with GOSSIP VALIDATION message to
     * signify whether this message is well-formed or not. Well-formedness of a message could be
     * defined as whether the mesage’s data is according to the expected format, its fields make
     * sense, any digital signatures in it verify OK or not. Gossip then propagates this message to
     * other peers if it is well-formed.
     * 
     */
    const size = Buffer.alloc(2);
    const messageType = Buffer.alloc(2);

    size.writeUInt16BE(data.length + 16);
    messageType.writeUInt16BE(502);

    const payload = Buffer.concat([size, messageType, messageID, dataType, data]);

    this.Topics[dataType.toString()].forEach((socket) => {
      socket.write(payload);
    })
  }

  private handleValidation(data: Buffer) {
    /** TODO：
     * The message is used to tell Gossip whether the GOSSIP NOTIFICATION with the given message ID 
     * is well-formed or not. The bitfield V, if set signifies the the notification is wellformed; 
     * otherwise it is to be deemed invalid and hence should not be propagated further.
     */
    const messageID = data.subarray(32, 48);
    const reserved = data.subarray(48, 55);
    const valid = data.subarray(55, 56);

    console.log(`messageID: ${messageID}`);
    console.log(`reserved: ${reserved}`);
    console.log(`valid: ${valid}`);

    if (valid.readUInt8(0) === 1) {
      this.broadcast(messageID);
    } else {
      this.handleErrorMesssage(messageID);
    }
  }

  private getNetAddresses(socket: net.Socket) {
    return socket.remoteAddress + ':' + socket.remotePort;
  }
}
