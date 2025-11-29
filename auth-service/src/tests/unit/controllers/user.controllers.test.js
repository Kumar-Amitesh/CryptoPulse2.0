import { jest } from '@jest/globals';

// MOCKS

// Mock User Model
// await jest.unstable_mockModule('../../../models/Users.models.js', () => ({
//   default: {
//     findOne: jest.fn(),
//     create: jest.fn(),
//     findById: jest.fn(),
//   },
// }));
import { UserModelMock } from '../../__mocks__/db.mock.js';
await jest.unstable_mockModule('../../../models/Users.models.js', () => (UserModelMock));

// Mock Cloudinary utils
await jest.unstable_mockModule('../../../utils/cloudinary.utils.js', () => ({
  uploadOnCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
}));

// Mock FS to avoid deleting actual files
await jest.unstable_mockModule('fs', () => ({
  default: {
    unlinkSync: jest.fn(),
  },
}));

import { RedisMock } from '../../__mocks__/redis.mock.js';
await jest.unstable_mockModule('../../../config/redis.config.js', () => (RedisMock));

import ApiResponseMock from '../../__mocks__/ApiResponse.mock.js';
await jest.unstable_mockModule('../../../utils/ApiResponse.utils.js', () => (ApiResponseMock));

await jest.unstable_mockModule('../../../utils/asyncHandler.utils.js', () => (import ('../../__mocks__/asyncHandler.mock.js')));


// IMPORTS
const User = (await import('../../../models/Users.models.js')).default;
const { uploadOnCloudinary } = await import('../../../utils/cloudinary.utils.js');
const fs = (await import('fs')).default;

const { registerUser } = await import('../../../controllers/user.controllers.js');

// TEST SUITE
describe('User Controller - Register', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {
        fullName: 'John Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
      },
      file: { path: 'temp/avatar.jpg' },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  // TEST 1: SUCCESS CASE
  test('should register a new user successfully', async () => {
    User.findOne.mockResolvedValue(null); // user does not exist
    uploadOnCloudinary.mockResolvedValue({ url: 'https://cloudinary.com/avatar.jpg' });

    const mockUser = { _id: 'user123', ...req.body, avatar: 'avatar' };

    User.create.mockResolvedValue(mockUser);

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    await registerUser(req, res, next);

    expect(User.findOne).toHaveBeenCalled();
    expect(uploadOnCloudinary).toHaveBeenCalled();
    expect(User.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
  });

  // TEST 2: USER ALREADY EXISTS
  test('should fail if user already exists', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });

    await registerUser(req, res, next);

    expect(User.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('temp/avatar.jpg');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'User with email or username already exist',
      })
    );
  });
});
