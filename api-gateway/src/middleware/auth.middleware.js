import ApiError from '../utils/ApiError.utils.js'
import jwt from 'jsonwebtoken'
import asyncHandler from '../utils/asyncHandler.utils.js'
import User from '../models/Users.models.js'
const verifyJWT = asyncHandler(
    async(req,_,next) => {
        try{
            const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")

            if(!token){
                throw new ApiError(401,'Unauthorized Request')
            }

            const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
            const user = await User.findById(decodedToken?._id).select("+refreshToken")

            if(!user){
                throw new ApiError(401,'Invalid Access Token')
            }

            if(!user.refreshToken){
                throw new ApiError(401,'Login again')
            }
            req.user = {
                _id: user._id,
                email: user.email,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatar
            }
            // headers persist through proxying, while arbitrary req fields often don’t.
            req.headers['X-USER-Id'] = user._id;
            next()
        }
        catch(error){
            throw new ApiError(401,error?.message||'Invalid access token')
        }
    }
)

export default verifyJWT