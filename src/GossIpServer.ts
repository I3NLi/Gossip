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

  private handleAnnounce(data: Buffer) {
    /** TODO: 
     * Message to instruct Gossip to spread the knowledge about given data item. It is sent from
     * other modules to the Gossip module. No return value or confirmation is sent by Gossip for
     * this message. The Gossip should put in its best effort to spread this information.
     * 
     * The TTL field specifies until how many hops the overlying application requires this data
     * to be spread. A value of 0 implies unlimited hops. The data type field specifies the type
     * of the application data. The data type should not be confused with the message type field:
     * While they are similar, message types are used to identify messages in the API protocols,
     * whereas the data type is used to identify the application data Gossip spreads in the network.
     * 
     * Since this message does not evoke a response from Gossip, no assumptions about successful
     * spreading of the data in the message can be made. Knowledge spreading is best effort and
     * can only be seen as probabilistic. However, with enough cache size and well connectivity, it
     * is very likely to achieve a good chance of knowledge spreading in the network.
     * 
     * */
    const ttl = data.readUIntBE(4, 1);
    const reserved = data.readUIntBE(5, 1);
    const dataType = data.readUInt16BE(6);
    const messageData = data.subarray(8);
    console.log(`TTL: ${ttl}`);
    console.log(`Reserved: ${reserved}`);
    console.log(`Data Type: ${dataType}`);
    console.log(`Message Data: ${messageData.toString()}`);
    console.log('\n');
  }

  private handleNotify(data: Buffer, socket: net.Socket) {
    /**
     * This message serves two purposes. Firstly, it is used to instruct Gossip to notify the module
     * sending this message when a new application data message of given type is received by it.
     * The new data message could have been received from another peer or by another module
     * of the local peer. The caller of this API will be notified by the Gossip through GOSSIP
     * NOTIFICATION messages (See Section 4.2.3). The data type field specifies which type of
     * messages the caller is interested in being notified.
     * The second purpose of this message is to tell Gossip which message types are valid and
     * hence should be propagated further. This means only messages for which a module has
     * registered a notification from Gossip will be propagated by Gossip. */

    const reserved = data.readUInt16BE(4);
    const dataType = data.readUInt16BE(6);
    if (this.Topics[dataType] === undefined) {
      this.Topics[dataType] = [];
    }

    if (this.Topics[dataType].includes(socket)) {
      console.error('Socket already in topic');
    } else {
      this.Topics[dataType].push(socket);
    }
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
