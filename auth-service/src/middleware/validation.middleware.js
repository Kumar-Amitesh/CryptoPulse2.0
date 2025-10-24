import { check, oneOf, validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.utils.js'
import logger from '../utils/logger.utils.js'

const validateRegister = [
    check('email')
    .isEmail()
    .withMessage('Invalid email')
    .normalizeEmail()
    .trim()
    .escape(),

    check('password')
    .isLength({min: 3})
    .withMessage('Password must be at least 8 characters long')
    .trim()
    .escape(),

    (req,res,next) => {
        const errors = validationResult(req)
        // console.log(errors)
        if(!errors.isEmpty()){
            logger.error('Validation failed during register: ',errors.array())
            throw new ApiError(400,'Validation Failed',errors.array())
        }
        next()
    }
]


const validateLogin = [
    oneOf([
        check('email')
            .isEmail()
            .withMessage('Invalid email')
            .normalizeEmail()
            .trim()
            .escape(),
        check('username')
            .notEmpty()
            .withMessage('Username is required')
            .trim()
            .escape()
    ], 'Either a valid email or username is required'),
    
    check('password')
        .notEmpty()
        .withMessage('Password is required')
        .trim()
        .escape(),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error('Validation failed during login: ', errors.array());
            return next(new ApiError(400, 'Validation Failed', errors.array()));
        }
        next();
    }
];


export { validateRegister, validateLogin };