// to interact with google api like calendar, drive etc.
import axios from 'axios';
import asyncHandler from './asyncHandler.js';  
import redisClient from '../config/redis.config.js';
import User from '../models/Users.models.js';
import ApiError from './ApiError.utils.js'
import logger from './logger.utils.js';

const refreshGoogleAccessToken = asyncHandler(async(userID)=>{

    const cached = await redisClient.get(`google:oauth2:user:${userID}`)
    if (cached) {
        return JSON.parse(cached).accessToken;
    }

    const user = await User.findById(userID)
    if(!user || !user.oauth?.providerRefreshToken){
        throw new ApiError(400, 'User not found or does not have a refresh token')
    }

    try{
        const response = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: user.oauth.providerRefreshToken,
                grant_type: 'refresh_token'
            }
        )

        const { access_token, expires_in } = response.data

        await redisClient.setEx(
            `google:oauth2:user:${user._id}`,
            expires_in,
            JSON.stringify({
                accessToken: access_token
            })
        )

        return access_token
    }
    catch(err){
        logger.error('Error while refreshing Google access token: ', err)
        throw new ApiError(500, 'Error while refreshing Google access token')
    }
})

export {
    refreshGoogleAccessToken
}