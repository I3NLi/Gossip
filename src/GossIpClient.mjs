import net from 'net';
import struct from 'struct';
import readline from 'readline';

export default class GossipClient {
  constructor() {
    this.GOSSIP_ADDR = "127.0.0.1";
    this.GOSSIP_PORT = 7001;
  }

  sendGossipAnnounce(s) {
    const DATA_TYPE = 1337;
    const DATA_CONT = Buffer.from("deadbeef", 'hex');
    const DATA_TTL = 4;

    const bsize = 4 + 4 + DATA_CONT.length;
    const buf = struct.pack(">HHBBH", bsize, 500, DATA_TTL, 0, DATA_TYPE);
    buf.append(DATA_CONT);

    console.log("[+] Prepared GOSSIP_ANNOUNCE packet:");
    console.log(buf.toString('hex'));

    s.write(buf);
    console.log(`[+] Sent GOSSIP_ANNOUNCE (${DATA_TYPE}, ${DATA_CONT.toString('hex')})`);
  }

  sendGossipNotify(s) {
    const DATA_TYPE = 1337;

    const bsize = 4 + 4;
    const buf = struct.pack(">HHHH", bsize, 501, 0, DATA_TYPE);

    s.write(buf);
    console.log(`[+] Sent GOSSIP_NOTIFY for type ${DATA_TYPE}.`);
  }

  waitNotification(s) {
    const buf = syncReadMessage(s);
    const [msize, mtype, mid, dtype] = struct.unpack(">HHHH", buf.slice(0, 8));
    const mdata = buf.slice(8);

    if (mtype !== 502) {
      const reason = `Wrong packet type: ${mtype}`;
      syncBadPacket(buf, s, reason);
    }

    console.log(`[+] Got GOSSIP_NOTIFICATION: mID = ${mid}, type = ${dtype}, data = ${mdata.toString()}`);
    console.log(buf.toString('hex'));
    return mid;
  }

  sendGossipValidation(s, mid, valid = true) {
    const bsize = 4 + 4;
    const buf = struct.pack(">HHHBB", bsize, 503, mid, 0, valid ? 1 : 0);

    s.write(buf);
    const validstr = valid ? "Valid" : "Invalid";
    console.log(`[+] Sent GOSSIP_VALIDATION: mid = ${mid}, ${validstr}).`);
  }

  start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Enter GOSSIP host module IP (default: 127.0.0.1): ", (destination) => {
      if (destination.trim() !== "") {
        this.GOSSIP_ADDR = destination.trim();
      }

      rl.question("Enter GOSSIP host module port (default: 7001): ", (port) => {
        if (port.trim() !== "") {
          this.GOSSIP_PORT = parseInt(port.trim());
        }

        const s = net.createConnection(this.GOSSIP_PORT, this.GOSSIP_ADDR, () => {
          console.log("[+] Connected to gossip module:", this.GOSSIP_ADDR, this.GOSSIP_PORT);

          this.sendGossipNotify(s);

          console.log("Press any key to send gossip_announce message...");
          rl.on('line', () => {
            this.sendGossipAnnounce(s);
          });
        });

        s.on('end', () => {
          console.log("Connection closed.");
          rl.close();
        });
      });
    });
  }
}

// Usage:
const client = new GossipClient();
client.start();
