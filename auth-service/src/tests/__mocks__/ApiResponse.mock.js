import { jest } from '@jest/globals';

export default ApiResponseMock = {
    default: jest.fn().mockImplementation((status, data, message) => ({
        success: true,
        data,
        message,
    })),
}