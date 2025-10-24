// express-validation is an express middleware that validates a request and returns a response with errors; if any of the configured validation rules fail.

// While the user can no longer send empty person names, it can still inject HTML into your page! This is known as the Cross-Site Scripting vulnerability (XSS).

// express-validator validators do not report validation errors to users automatically.
// The reason for this is simple: as you add more validators, or for more fields, how do you want to collect the errors? Do you want a list of all errors, only one per field, only one overall...?

// oneOf - Creates a middleware that will ensure that at least one of the given validation chains or validation chain groups are valid.

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

    // withMessage - Sets the error message for the previous validator.
    check('password')
    .isLength({min: 3})
    .withMessage('Password must be at least 8 characters long')
    .trim()
    .escape(),

    (req,res,next) => {
        // Extracts the validation errors of an express request
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