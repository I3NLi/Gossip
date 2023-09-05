
/**
 * Class representing a MessageType.
 *
 * This class provides methods for mapping message types to codes and vice versa.
 */

class MessageType {
    private MESSAGETYPE: Record<string, string> = {
        "500": "GOSSIP ANNOUNCE",
        "501": "GOSSIP NOTIFY",
        "502": "GOSSIP NOTIFICATION",
        "503": "GOSSIP VALIDATION",

        "505": "GOSSIP ENROLL INIT",
        "506": "GOSSIP ENROLL CHALLENGE",
        "507": "GOSSIP ENROLL REGISTER",
        "508": "GOSSIP ENROLL SUCCESS",

        "509": "GOSSIP RESPONSE FAILURE",
        "510": "GOSSIP BORDCAST",



        "519": "reserved until here for Gossip",
        "520": "NSE QUERY",
        "521": "NSE ESTIMATE",
        "539": "reserved until here for NSE",
        "540": "RPS QUERY",
        "541": "RPS PEER",
        "559": "reserved until here for RPS",
        "560": "ONION TUNNEL BUILD",
        "561": "ONION TUNNEL READY",
        "562": "ONION TUNNEL INCOMING",
        "563": "ONION TUNNEL DESTROY",
        "564": "ONION TUNNEL DATA",
        "565": "ONION ERROR",
        "566": "ONION COVER",
        "599": "reserved until here for Onion",
        "600": "AUTH SESSION START",
        "601": "AUTH SESSION HS1",
        "602": "AUTH SESSION INCOMING HS1",
        "603": "AUTH SESSION HS2",
        "604": "AUTH SESSION INCOMING HS2",
        "605": "AUTH LAYER ENCRYPT",
        "606": "AUTH LAYER DECRYPT",
        "607": "AUTH LAYER ENCRYPT RESP",
        "608": "AUTH LAYER DECRYPT RESP",
        "609": "AUTH SESSION CLOSE",
        "610": "AUTH ERROR",
        "611": "AUTH CIPHER ENCRYPT",
        "612": "AUTH CIPHER ENCRYPT RESP",
        "613": "AUTH CIPHER DECRYPT",
        "614": "AUTH CIPHER DECRYPT RESP",
        "649": "reserved until here for Onion Auth",
        "650": "DHT PUT",
        "651": "DHT GET",
        "652": "DHT SUCCESS",
        "653": "DHT FAILURE",
        "679": "reserved until here for DHT",
        "680": "ENROLL INIT",
        "681": "ENROLL REGISTER",
        "682": "ENROLL SUCCESS",
        "683": "ENROLL FAILURE",
        "689": "reserved until here for ENROLL"
    }
    private MESSAGETYPE_INV: Record<string, string> = this.reverseObjectKeyValue(this.MESSAGETYPE)

    private reverseObjectKeyValue(inputObject: Record<string, string>): Record<string, string> {
        const reversedObject: Record<string, string> = {};

        for (const key in inputObject) {
            if (Object.prototype.hasOwnProperty.call(inputObject, key)) {
                const value = inputObject[key];
                reversedObject[value] = key;
            }
        }
        return reversedObject;
    }
    /**
    * Get the message type code for a given message type name.
    * @param name - The message type name.
    * @returns The message type code.
    */
    public getCode(name: string): string {
        return this.MESSAGETYPE_INV[name]
    }
    /**
    * Get the message type name for a given message type code.
    * @param code - The message type code.
    * @returns The message type name.
    */
    public getName(code: string): string {
        return this.MESSAGETYPE[code]

    }
}

export default new MessageType();