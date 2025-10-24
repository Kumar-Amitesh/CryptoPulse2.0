import Router from 'express'
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    chnageCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    googleAuthentication,
    googleAuthorizationCallback
} from '../controllers/user.controllers.js'
import upload from '../middleware/multer.middleware.js'
import {
    validateRegister,
    validateLogin
} from '../middleware/validation.middleware.js'
// import verifyJWT from '../middleware/auth.middleware.js'

const router = Router()

router.route('/register').post(
    upload.single('avatar'),
    validateRegister,
    registerUser
)

router.route('/login').post(validateLogin,loginUser)
router.route('/auth/google').get(googleAuthentication)
router.route('/auth/google/callback').get(googleAuthorizationCallback)

//secured routes
router.route('/logout').get(logoutUser)
router.route('/refresh-token').post(refreshAccessToken)
router.route('/change-password').post(chnageCurrentPassword)
router.route('/current-user').get(getCurrentUser)
router.route('/update-account').post(updateAccountDetails)

router.route('/update-avatar').post(upload.single('avatar'),updateUserAvatar)

export default router