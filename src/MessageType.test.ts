import MESSAGETYPE from './MessageType';

describe('MESSAGETYPE', () => {
    it('should get code by name', () => {
        const code = MESSAGETYPE.getCode('GOSSIP ANNOUNCE');
        expect(code).toBe('500');
    });

    it('should get name by code', () => {
        const name = MESSAGETYPE.getName('500');
        expect(name).toBe('GOSSIP ANNOUNCE');
    });
});