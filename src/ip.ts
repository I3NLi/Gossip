/*
 * Created Date: Monday, August 28th 2023, 12:39:47 am
 * Author: Boning Li
 * 
 * Copyright (c) 2023 Boning Li
 */



class Ip {
    /** String to Buffer */
    public toBuffer(ip: string): Buffer | undefined {
        if (this.isValidIPv4(ip)) {
            return this.ipv4StringToBuffer(ip);
        } else if (this.isValidIPv6(ip)) {
            return this.ipv6StringToBuffer(ip);
        } else {
            return undefined;
        }

    }
    public ipv4StringToBuffer(ipv4: string): Buffer | undefined {
        const parts = ipv4.split('.');

        if (parts.length !== 4) {
            // throw new Error('Invalid IPv4 format');
            return undefined
        }

        const buffer = Buffer.alloc(4);

        for (let i = 0; i < 4; i++) {
            const octet = parseInt(parts[i], 10);

            if (isNaN(octet) || octet < 0 || octet > 255) {
                return undefined; // Invalid octet value
            }

            buffer.writeUInt8(octet, i);
        }

        return buffer;
    }
    public ipv6StringToBuffer(ipv6: string): Buffer | undefined {
        // Normalize IPv6 string by expanding abbreviations
        const normalizedIPv6 = this.normalizeIPv6(ipv6);

        const parts = normalizedIPv6.split(':');

        if (parts.length !== 8) {
            return undefined; // IPv6 should have 8 parts

        }

        const buffer = Buffer.alloc(16);

        for (let i = 0; i < 8; i++) {
            const value = parseInt(parts[i], 16);

            if (isNaN(value) || value < 0 || value > 0xFFFF) {
                return undefined; // Invalid value
            }

            buffer.writeUInt16BE(value, i * 2);
        }

        return buffer;
    }

    public ipv4AddressStringToBuffer(address: string, throwError: boolean = false): Buffer | undefined {
        const [ip, port] = address.split(':');

        // Convert IP address to a Buffer
        const ipBuffer = this.ipv4StringToBuffer(ip);
        if (!ipBuffer) {
            if (throwError) {
                throw new Error('Invalid IP address');
            }
            return undefined; // Invalid IP address
        }

        // Convert port to a 2-byte Buffer
        const portNumber = parseInt(port, 10);
        if (isNaN(portNumber) || portNumber < 0 || portNumber > 65535) {
            if (throwError) {
                throw new Error('Invalid port');
            }
            return undefined; // Invalid port
        }
        const portBuffer = Buffer.alloc(2);
        portBuffer.writeUInt16BE(portNumber, 0);

        // Concatenate IP and port buffers to create the final buffer
        const finalBuffer = Buffer.concat([ipBuffer, portBuffer]);

        return finalBuffer;
    }
    public ipv6AddressStringToBuffer(address: string, throwError: boolean = false): Buffer | undefined {
        const lastColonIndex = address.lastIndexOf(':');
        if (lastColonIndex === -1) {
            if (throwError) {
                throw new Error('Invalid address format');
            }
            return undefined;
        }

        let ipPart = address.substring(0, lastColonIndex);
        const ipPartMatch = ipPart.match(/\[(.*)\]/);
        ipPart = ipPartMatch ? ipPartMatch[1] : ipPart;
        const portPart = address.substring(lastColonIndex + 1);

        if (!portPart && throwError) { throw new Error('Invalid port'); }
        if (!ipPart && throwError) { throw new Error('Invalid IPv6 address'); }
        if (!portPart || !ipPart) { return undefined; }

        // Convert IPv6 address to a Buffer
        const ipBuffer = this.ipv6StringToBuffer(ipPart);
        if (!ipBuffer) {
            if (throwError) {
                throw new Error('Invalid IPv6 address');
            }
            return undefined; // Invalid IPv6 address
        }

        // Convert port to a 2-byte Buffer
        const portNumber = parseInt(portPart, 10);
        if (isNaN(portNumber) || portNumber < 0 || portNumber > 65535) {
            if (throwError) {
                throw new Error('Invalid port');
            }
            return undefined; // Invalid port
        }
        const portBuffer = Buffer.alloc(2);
        portBuffer.writeUInt16BE(portNumber, 0);

        // Concatenate IPv6 and port buffers to create the final buffer
        const finalBuffer = Buffer.concat([ipBuffer, portBuffer]);

        return finalBuffer;
    }

    /** ipv6 umform */
    // Normalize IPv6 by expanding abbreviations like '::'
    public normalizeIPv6(ipv6: string): string {
        if (ipv6 == "") {
            return "";
        }
        // Normalize IPv6 by expanding abbreviations like '::'
        const parts = ipv6.split(':');
        let expandedParts: string[] = [];

        let hasExpandedParts = false
        for (const part of parts) {
            if (part === '') {
                if (hasExpandedParts) {
                    return ""; // Invalid format
                }
                expandedParts = expandedParts.concat(new Array(9 - parts.length).fill('0000'));
                hasExpandedParts = true;
            } else {

                expandedParts.push(part.padStart(4, '0'));
            }
        }

        return expandedParts.join(':');
    }
    // Shorten IPv6 by removing leading zeros
    public shortenIPv6(ipv6: string) {
        const groups = this.normalizeIPv6(ipv6).split(':');
        let shortGroups = [];
        let zeroGroupCount = 0;
        let zeroGroupIndex = -1;

        // Count the consecutive zero groups and find their starting index
        for (let i = 0; i < groups.length; i++) {
            if (groups[i] === '0000') {
                if (zeroGroupCount === 0) {
                    zeroGroupIndex = i;
                }
                zeroGroupCount++;
            } else {
                if (zeroGroupCount > 1) {
                    shortGroups.push('');
                }
                zeroGroupCount = 0;
                shortGroups.push(groups[i]);
            }
        }

        // If there are trailing zero groups, add them
        if (zeroGroupCount > 1) {
            shortGroups.push('');
        }

        // If there are leading zero groups, add them
        if (zeroGroupIndex > 0) {
            shortGroups = [''].concat(shortGroups);
        }

        return shortGroups.join(':');
    }

    /** is valid String */
    public isValid(ip: string): boolean {
        return this.isValidIPv4(ip) || this.isValidIPv6(ip);
    }
    public isValidIPv4(ipv4: string): boolean {
        const parts = ipv4.split('.');

        if (parts.length !== 4) {
            return false; // IPv4 should have 4 parts
        }

        for (const part of parts) {
            const value = parseInt(part, 10);

            if (isNaN(value) || value < 0 || value > 255 || !Number.isInteger(value)) {
                return false; // Each part should be a valid integer between 0 and 255
            }
        }

        return true;
    }
    public isValidIPv6(ipv6: string): boolean {

        if (ipv6 == "") {
            return false;
        }
        const parts = this.normalizeIPv6(ipv6).split(':');

        if (parts == undefined || parts.length !== 8) {
            return false;
        }

        for (const part of parts) {
            const value = parseInt(part, 16);
            if (isNaN(value) || value < 0 || value > 0xFFFF) {
                return false;
            }
        }

        return true;
    }

    /** Buffer to String */
    public ipBufferToString(buffer: Buffer): string | undefined {
        if (buffer.length === 16) {
            return this.ipv6BufferToString(buffer)
        } else if (buffer.length === 4) {
            return this.ipv4BufferToString(buffer)
        } else {
            return undefined
        }
    }
    public ipv4BufferToString(buffer: Buffer): string | undefined {
        if (Buffer.isBuffer(buffer) && buffer.length === 4) {
            return buffer.join('.');
        }
        return undefined;
    }
    public ipv6BufferToString(buffer: Buffer, shorten = true): string | undefined {
        if (Buffer.isBuffer(buffer) && buffer.length === 16) {
            const groups = [];
            for (let i = 0; i < 16; i += 2) {
                const value = buffer.readUInt16BE(i).toString(16).padStart(4, '0');
                groups.push(value);
            }
            const ipv6 = groups.join(':')
            return shorten ? this.shortenIPv6(ipv6) : ipv6;

        }
        return undefined;
    }

    public ipv4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
    public ipv6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;

}

export default new Ip();