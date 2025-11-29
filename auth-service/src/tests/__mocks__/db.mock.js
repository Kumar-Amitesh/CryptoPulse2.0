import { jest } from '@jest/globals';

export const UserModelMock = {
    default: {
        findOne: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
    }
}