import { jest } from '@jest/globals';

export const RedisMock = {
    client: {
        on: jest.fn(),
        connect: jest.fn(),
        quit: jest.fn(),
    }
}