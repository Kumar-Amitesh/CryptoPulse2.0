import { jest } from '@jest/globals';

// MOCKS
await jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        verify: jest.fn(),
    }
}));

import { UserModelMock } from '../../__mocks__/db.mock.js';
await jest.unstable_mockModule('../../../models/Users.models.js', () => (UserModelMock));

await jest.unstable_mockModule('../../../utils/asyncHandler.utils.js', () => (import ('../../__mocks__/asyncHandler.mock.js')));

import APIErrorMock from '../../__mocks__/ApiError.mock.js';
await jest.unstable_mockModule('../../../utils/ApiError.utils.js', () => (APIErrorMock));

const jwt = (await import('jsonwebtoken')).default;
const User = (await import('../../../models/Users.models.js')).default;
const verifyJWT = (await import('../../../middleware/auth.middleware.js')).default;

describe('Auth Middleware - verifyJWT', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { 
            cookies: {},
            header: jest.fn().mockReturnValue(null) 
        };
        res = {};
        next = jest.fn();
    });

    test('should populate req.user if token is valid', async () => {
        // Setup
        req.cookies.accessToken = 'valid_token';
        const mockUser = { _id: 'user123', email: 'test@test.com', refreshToken: 'valid_refresh' };

        jwt.verify.mockReturnValue({ _id: 'user123' });
        
        // Mock Mongoose chain: User.findById().select()
        const selectMock = jest.fn().mockResolvedValue(mockUser);
        User.findById.mockReturnValue({ select: selectMock });

        await verifyJWT(req, res, next);

        expect(req.user).toBeDefined();
        expect(req.user._id).toBe('user123');
        expect(next).toHaveBeenCalledWith(); // Called without error
    });

    test('should throw 401 if no token provided', async () => {
        // No cookies, no header
        await verifyJWT(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            message: 'Unauthorized Request'
        }));
    });

    test('should throw 401 if token is invalid', async () => {
        req.header.mockReturnValue('Bearer invalid_token');
        
        jwt.verify.mockImplementation(() => {
            throw new Error('invalid signature');
        });

        await verifyJWT(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 401,
            message: 'invalid signature'
        }));
    });
});