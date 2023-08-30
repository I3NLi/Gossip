/*
 * Created Date: Monday, August 28th 2023, 12:39:47 am
 * Author: Boning Li
 * 
 * Copyright (c) 2023 Boning Li
 */


import IP from '../ip';
/** toBuffer */
describe('toBuffer', () => {
    it('should convert valid IPv4 address to buffer', () => {
        const ipv4Address = '192.168.1.1';
        const buffer = IP.toBuffer(ipv4Address);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should convert valid IPv6 address to buffer', () => {
        const ipv6Address = '2001:0db8::8a2e:370:7334';
        const buffer = IP.toBuffer(ipv6Address);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should return undefined for invalid IP address', () => {
        const invalidAddress = 'invalid_address';
        const buffer = IP.toBuffer(invalidAddress);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for empty IP address', () => {
        const emptyAddress = '';
        const buffer = IP.toBuffer(emptyAddress);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but invalid IP address', () => {
        const invalidIPv4 = '256.256.256.256';
        const buffer = IP.toBuffer(invalidIPv4);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but invalid IPv6 address', () => {
        const invalidIPv6 = 'invalid_ipv6';
        const buffer = IP.toBuffer(invalidIPv6);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for IPv6 address with invalid format', () => {
        const invalidIPv6Format = '[invalid_ipv6]';
        const buffer = IP.toBuffer(invalidIPv6Format);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for IPv4 address with invalid format', () => {
        const invalidIPv4Format = '256.256.256.256';
        const buffer = IP.toBuffer(invalidIPv4Format);
        expect(buffer).toBeUndefined();
    });
});

describe('ipv4StringToBuffer', () => {
    it('should convert valid IPv4 address to buffer', () => {
        const validIPv4 = '192.168.1.1';
        const buffer = IP.ipv4StringToBuffer(validIPv4);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should return undefined for invalid IPv4 format', () => {
        const invalidIPv4 = '192.168.1.1.1';
        const buffer = IP.ipv4StringToBuffer(invalidIPv4);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for invalid IPv4 octet value', () => {
        const invalidIPv4 = '192.168.1.256';
        const buffer = IP.ipv4StringToBuffer(invalidIPv4);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but invalid IPv4 octet value', () => {
        const invalidIPv4 = '192.168.1.invalid';
        const buffer = IP.ipv4StringToBuffer(invalidIPv4);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but incomplete IPv4', () => {
        const invalidIPv4 = '192.168.1';
        const buffer = IP.ipv4StringToBuffer(invalidIPv4);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but empty IPv4', () => {
        const emptyIPv4 = '';
        const buffer = IP.ipv4StringToBuffer(emptyIPv4);
        expect(buffer).toBeUndefined();
    });
});

describe('ipv6StringToBuffer', () => {
    it('should convert valid IPv6 address to buffer', () => {
        const validIPv6 = '2001:0db8::8a2e:370:7334';
        const buffer = IP.ipv6StringToBuffer(validIPv6);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should return undefined for invalid IPv6 format', () => {
        const invalidIPv6 = '2001:0db8::8a2e::370:7334';
        const buffer = IP.ipv6StringToBuffer(invalidIPv6);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for invalid IPv6 value', () => {
        const invalidIPv6 = '2001:0db8::8a2e:gggg:7334';
        const buffer = IP.ipv6StringToBuffer(invalidIPv6);
        expect(buffer).toBeUndefined();
    });

    it('should return buffer for valid format', () => {
        const validIncompleteIPv6 = '2001:0db8::8a2e:370';
        const buffer = IP.ipv6StringToBuffer(validIncompleteIPv6);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should return undefined for valid format but empty IPv6', () => {
        const emptyIPv6 = '';
        const buffer = IP.ipv6StringToBuffer(emptyIPv6);
        expect(buffer).toBeUndefined();
    });
});

describe('ipv4AddressStringToBuffer', () => {


    it('should convert valid IPv4 address with port to buffer', () => {
        const ipv4Address = '192.168.1.1:8000';
        const buffer = IP.ipv4AddressStringToBuffer(ipv4Address);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should return undefined for valid format but invalid IP', () => {
        const ipv4Address = '256.256.256.256:8000';
        const buffer = IP.ipv4AddressStringToBuffer(ipv4Address);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for invalid format', () => {
        const invalidAddress = 'invalid_address';
        const buffer = IP.ipv4AddressStringToBuffer(invalidAddress);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid IP but invalid port', () => {
        const ipv4Address = '192.168.1.1:invalid_port';
        const buffer = IP.ipv4AddressStringToBuffer(ipv4Address);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid IP and valid port out of range', () => {
        const ipv4Address = '192.168.1.1:70000';
        const buffer = IP.ipv4AddressStringToBuffer(ipv4Address);
        expect(buffer).toBeUndefined();
    });

    it('should convert valid IPv4 address without port to buffer', () => {
        const ipv4Address = '192.168.1.1';
        const buffer = IP.ipv4AddressStringToBuffer(ipv4Address);
        expect(buffer).toEqual(undefined);
    });

    it('should throw error for invalid IPv4 address with throwError=true', () => {
        const ipv4Address = '256.256.256.256:8000';
        expect(() => {
            IP.ipv4AddressStringToBuffer(ipv4Address, true);
        }).toThrow('Invalid IP address');
    });

    it('should throw error for invalid port with throwError=true', () => {
        const ipv4Address = '192.168.1.1:invalid_port';
        expect(() => {
            IP.ipv4AddressStringToBuffer(ipv4Address, true);
        }).toThrow('Invalid port');
    });

    it('should throw error for valid IP and valid port out of range with throwError=true', () => {
        const ipv4Address = '192.168.1.1:70000';
        expect(() => {
            IP.ipv4AddressStringToBuffer(ipv4Address, true);
        }).toThrow('Invalid port');
    });
});

describe('ipv6AddressStringToBuffer', () => {


    it('should convert valid IPv6 address with port to buffer', () => {
        const ipv6Address = '[2001:0db8::8a2e:370:7334]:8000';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should convert valid IPv6 address without port to buffer', () => {
        const ipv6Address = '2001:0db8::8a2e:370:7334';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address);
        expect(buffer).toEqual(expect.any(Buffer));
    });

    it('should throw error for invalid IPv6 address with throwError=true', () => {
        const ipv6Address = '[invalid_ipv6]:8000';
        expect(() => {
            IP.ipv6AddressStringToBuffer(ipv6Address, true);
        }).toThrow('Invalid IPv6 address');
    });

    it('should throw error for invalid port with throwError=true', () => {
        const ipv6Address = '[2001:0db8::8a2e:370:7334]:invalid_port';
        expect(() => {
            IP.ipv6AddressStringToBuffer(ipv6Address, true);
        }).toThrow('Invalid port');
    });

    it('should return undefined for invalid format', () => {
        const invalidAddress = 'invalid_address';
        const buffer = IP.ipv6AddressStringToBuffer(invalidAddress);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid format but invalid IP', () => {
        const ipv6Address = '[invalid_ipv6]:8000';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for valid IP but invalid port', () => {
        const ipv6Address = '[2001:0db8::8a2e:370:7334]:invalid_port';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for invalid IPv6 address with throwError=false', () => {
        const ipv6Address = '[invalid_ipv6]:8000';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address, false);
        expect(buffer).toBeUndefined();
    });

    it('should return undefined for invalid port with throwError=false', () => {
        const ipv6Address = '[2001:0db8::8a2e:370:7334]:invalid_port';
        const buffer = IP.ipv6AddressStringToBuffer(ipv6Address, false);
        expect(buffer).toBeUndefined();
    });
});

/** IPv6 transform */
describe('normalizeIPv6', () => {
    it('should normalize IPv6 by expanding abbreviations', () => {
        const ipv6 = '2001::8a2e::7334';
        const normalized = IP.normalizeIPv6(ipv6);
        expect(normalized).toBe('');
    });

    it('should normalize fully expanded IPv6', () => {
        const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const normalized = IP.normalizeIPv6(ipv6);
        expect(normalized).toBe(ipv6);
    });

    it('should normalize empty input', () => {
        const ipv6 = '';
        const normalized = IP.normalizeIPv6(ipv6);
        expect(normalized).toBe('');
    });

    it('should return undefined for invalid format with multiple expansions', () => {
        const ipv6 = '2001::8a2e::7334::';
        const normalized = IP.normalizeIPv6(ipv6);
        expect(normalized).toBe('');
    });

    it('should return undefined for invalid format with no expansion', () => {
        const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334::';
        const normalized = IP.normalizeIPv6(ipv6);
        expect(normalized).toBe('');
    });
});


describe('shortenIPv6', () => {
    it('should shorten IPv6 by removing leading zeros', () => {
        const ipv6 = '2001:0000:0000:0000:0000:8a2e:0000:7334';
        const shortened = IP.shortenIPv6(ipv6);
        expect(shortened).toBe('2001::8a2e::7334');
    });

    it('should not change already shortened IPv6', () => {
        const ipv6 = '2001::8a2e::7334';
        const shortened = IP.shortenIPv6(ipv6);
        expect(shortened).toBe('');
    });
});
/** isValid */
describe('isValid', () => {
    it('should return true for valid IPv4 address', () => {
        const validIPv4 = '192.168.1.1';
        expect(IP.isValid(validIPv4)).toBe(true);
    });

    it('should return true for valid IPv6 address', () => {
        const validIPv6 = '2001:0db8::8a2e:370:7334';
        expect(IP.isValid(validIPv6)).toBe(true);
    });

    it('should return false for invalid IP address', () => {
        const invalidIP = 'invalid_address';
        expect(IP.isValid(invalidIP)).toBe(false);
    });

    it('should return false for empty IP address', () => {
        const emptyIP = '';
        expect(IP.isValid(emptyIP)).toBe(false);
    });

    it('should return false for valid format but invalid IP address', () => {
        const invalidIPv4 = '256.256.256.256';
        expect(IP.isValid(invalidIPv4)).toBe(false);
    });

    it('should return false for valid format but invalid IPv6 address', () => {
        const invalidIPv6 = 'invalid_ipv6';
        expect(IP.isValid(invalidIPv6)).toBe(false);
    });
});

describe('isValidIPv4', () => {
    it('should return true for valid IPv4 address', () => {
        const validIPv4 = '192.168.1.1';
        expect(IP.isValidIPv4(validIPv4)).toBe(true);
    });

    it('should return false for invalid IPv4 address', () => {
        const invalidIPv4 = '256.256.256.256';
        expect(IP.isValidIPv4(invalidIPv4)).toBe(false);
    });

    it('should return false for invalid format', () => {
        const invalidFormat = 'invalid_address';
        expect(IP.isValidIPv4(invalidFormat)).toBe(false);
    });
});

describe('isValidIPv6', () => {
    it('should return true for valid IPv6 address', () => {
        const validIPv6 = '2001:0db8::8a2e:370:7334';
        expect(IP.isValidIPv6(validIPv6)).toBe(true);
    });

    it('should return false for invalid IPv6 address', () => {
        const invalidIPv6 = 'invalid_ipv6';
        expect(IP.isValidIPv6(invalidIPv6)).toBe(false);
    });

    it('should return false for empty IPv6 address', () => {
        const emptyIPv6 = '';
        expect(IP.isValidIPv6(emptyIPv6)).toBe(false);
    });

    it('should return false for IPv6 address with invalid format', () => {
        const invalidFormat = '[invalid_ipv6]';
        expect(IP.isValidIPv6(invalidFormat)).toBe(false);
    });
});