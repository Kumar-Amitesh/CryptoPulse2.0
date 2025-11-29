import { jest } from '@jest/globals';

export default ApiErrorMock = {
    default: jest.fn().mockImplementation((statusCode, message = 'Something went wrong', errors = [], stack = '') => {
        return {
            statusCode,
            message,
            errors,
            stack: stack || (new Error()).stack,
        };
    })
}