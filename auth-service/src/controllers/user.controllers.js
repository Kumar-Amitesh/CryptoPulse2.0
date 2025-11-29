import asyncHandler from '../utils/asyncHandler.utils.js'
import ApiError from '../utils/ApiError.utils.js'
import ApiResponse from '../utils/ApiResponse.utils.js'
import User from '../models/Users.models.js'
import {
    uploadOnCloudinary,
    deleteFromCloudinary
} from '../utils/cloudinary.utils.js'
import logger from '../utils/logger.utils.js'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import axios from 'axios'
import{ client as redisClient }from '../config/redis.config.js'

const generateTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken

        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
    }
    catch(err){
        logger.error("Something went wrong while generating referesh and access token")
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler(async(req,res,next)=>{
    const {fullName,email,password,username} = req.body

    if(
        [fullName,username,email,password].some((field) => field?.trim()==="")
    ){
        throw new ApiError(400,'All fields are required')
    }

    const existedUser = await User.findOne({$or:[{username},{email}]})

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,'Avatar file is required')
    }

    if(existedUser){
        fs.unlinkSync(avatarLocalPath) // remove the locally saved temporary file
        throw new ApiError(400,'User with email or username already exist')
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar){
        throw new ApiError(500, "Avatar file upload failed")
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        email,
        password,
        username
    })

    const createdUser = await User.findById(user._id).select('-password -refreshToken')

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,'User registered successfully')
    )
});

const loginUser = asyncHandler(async(req,res,next)=>{
    const {email,username,password} = req.body

    if(!username && !email){
        throw new ApiError(400,'Username or Email Required')
    }

    const user = await User.findOne(
        {$or:[{username},{email}]}
    ).select('+password')

    if(!user){
        throw new ApiError(400,'User does not exist')
    }

    // Check if the user signed up using an OAuth provider
    if (user.oauth?.isOauth) {
        throw new ApiError(400, 
            `User registered with ${user.oauth.provider}. Please log in using Google.`
        );
    }

    const isPasswordValid = user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,'Invalid User Credentials')
    }

    const {accessToken, refreshToken} = await generateTokens(user._id)

    const loggedInUser = await User.findById(user._id).select('-password -refreshToken')

    return res
    .status(200)
    .cookie('accessToken',accessToken,{httpOnly:true, secure:true})
    .cookie('refreshToken',refreshToken,{httpOnly:true, secure:true})
    .json(
        new ApiResponse(200,{
            user:loggedInUser,
            accessToken:accessToken,
            refreshToken:refreshToken
        },'User logged in Successfully')
    )
});


const googleAuthentication = asyncHandler(async(req,res,next)=>{
    const {method} = req.query?.method || ''
    const state = crypto.randomBytes(20).toString('hex')

    const rawNonce = crypto.randomBytes(16).toString('hex')
    const nonce = crypto.createHash('sha256').update(rawNonce).digest('hex')

    await redisClient.setEx(`google:oauth2:state:${state}`,60*2,'valid')
    await redisClient.setEx(`google:oauth2:nonce:${nonce}`,60*2,'valid')

    try{
        const authURL = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&` +
        `response_type=${process.env.GOOGLE_OAUTH2_RESPONSE_TYPE}&` +
        `scope=${process.env.GOOGLE_OAUTH2_SCOPE}&` +
        `include_granted_scopes:true&` +
        `state=${state}&` +
        `nonce=${nonce}`

        if(method && method==='register'){
            authURL += `&prompt=consent&access_type=offline`
        }

        res.redirect(authURL)

    }
    catch(err){
        logger.error('Google Authentication Error: ', err)
        throw new ApiError(500, 'Google Authentication failed')
    }
})

const googleAuthorizationCallback = asyncHandler(async(req,res,next)=>{
    const {code,state, prompt} = req.query

    if(!state || !code){
        throw new ApiError(400, 'Invalid request parameters')
    }

    const isValidState = await redisClient.get(`google:oauth2:state:${state}`)

    if(!isValidState){
        throw new ApiError(400, 'Invalid or expired state parameter')
    }

    await redisClient.del(`google:oauth2:state:${state}`)

    try{
        const response = await axios.post(
            'https://oauth2.googleapis.com/token',
            {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code',
                code: code
            }
        )

        const { access_token, expires_in, id_token, token_type } = response.data
        const { refresh_token } = prompt === 'consent' ? response.data : {}
        const {header, payload, signature} = jwt.decode(id_token, {complete: true})
        const decodedToken = {
            ...payload, 
        }

        const { nonce } = decodedToken
        const isValidNonce = await redisClient.get(`google:oauth2:nonce:${nonce}`)
        if(!isValidNonce){
            throw new ApiError(400, 'Invalid or expired nonce parameter')
        }

        await redisClient.del(`google:oauth2:nonce:${nonce}`)

        //validating an id_token

        // Verify that the ID token is properly signed by the issuer.
        if(await redisClient.get(`google:oauth2:jwks_uri`)){
            const jwksUri = JSON.parse(await redisClient.get(`google:oauth2:jwks_uri`))
            const isValidIDTOKEN = jwksUri.some((key) => {
                return key.kid === header.kid && key.alg === header.alg
            })
            if(!isValidIDTOKEN){
                throw new ApiError(400, 'Invalid ID Token')
            }
        }
        else{
            const jwksUri = await axios.get('https://www.googleapis.com/oauth2/v3/certs')
            await redisClient.setEx(`google:oauth2:jwks_uri`, 60 * 60, JSON.stringify(jwksUri.data.keys))
            const isValidIDTOKEN = jwksUri.data.keys.some((key) => {
                return key.kid === header.kid && key.alg === header.alg
            })
            if(!isValidIDTOKEN){
                throw new ApiError(400, 'Invalid ID Token')
            }
        }
        // Verify that the value of the iss claim in the ID token
        if(decodedToken.iss !== 'accounts.google.com' && decodedToken.iss !== 'https://accounts.google.com'){
            throw new ApiError(400, 'Invalid ID Token issuer')
        }
        // Verify that the value of the aud claim in the ID token is equal to your app's client ID
        if(decodedToken.aud !== process.env.GOOGLE_CLIENT_ID){
            throw new ApiError(400, 'Invalid ID Token audience')
        }
        // Verify that the expiry time (exp claim) of the ID token has not passed.
        if(decodedToken.exp < Date.now() / 1000){
            throw new ApiError(400, 'ID Token has expired')
        }

        const user = await User.findOne({'oauth.providerId': decodedToken.sub})
        if(!user){
            // const newUser = await User.create({
            //     fullName: decodedToken.name,
            //     email: decodedToken.email,
            //     username: decodedToken.email.split('@')[0],
            //     password: crypto.randomBytes(16).toString('hex'), // generate a random password
            //     oauth: {
            //         isOauth: true,
            //         provider: 'google',
            //         providerId: decodedToken.sub,
            //         providerRefreshToken: refresh_token || null
            //     }
            // })

            // //upload the avatar to cloudinary
            // const avatar = await uploadOnCloudinary(decodedToken.picture)
            // newUser.avatar = avatar.url
            // await newUser.save({validateBeforeSave:false})

            // Not found by Google ID. Now, check if a user exists with that email.
            const existingUserWithEmail = await User.findOne({ email: email });

            if (existingUserWithEmail) {
                // User with this email exists! Link the Google account to them.
                
                // Check user aren't already linked to a different OAuth provider
                if (existingUserWithEmail.oauth?.isOauth) {
                    throw new ApiError(400, 'This email is already linked to another login method.');
                }

                existingUserWithEmail.oauth = {
                    isOauth: true,
                    provider: 'google',
                    providerId: decodedToken.sub,
                    providerRefreshToken: refresh_token || null 
                };
                
                existingUserWithEmail.fullName = decodedToken.name;
                if (picture) {
                    const avatar = await uploadOnCloudinary(picture);
                    existingUserWithEmail.avatar = avatar.url;
                }

                await existingUserWithEmail.save({ validateBeforeSave: false });
                user = existingUserWithEmail; 

            } else {
                // No user found by Google ID OR email. Create a new user.
                const newUser = await User.create({
                    fullName: decodedToken.name,
                    email: decodedToken.email,
                    username: decodedToken.email.split('@')[0],
                    password: crypto.randomBytes(16).toString('hex'), 
                    oauth: {
                        isOauth: true,
                        provider: 'google',
                        providerId: decodedToken.sub,
                        providerRefreshToken: refresh_token || null
                    }
                });

                const avatar = await uploadOnCloudinary(picture);
                newUser.avatar = avatar.url;
                await newUser.save({ validateBeforeSave: false });
                
                user = newUser; 
            }
        }

        const existingUser = user ? user : await User.findOne({'oauth.providerId': decodedToken.sub})

        await redisClient.setEx(
            `google:oauth2:user:${existingUser._id}`,
            expires_in,
            JSON.stringify({
                accessToken: access_token
            })
        )

        const {accessToken, refreshToken} = await generateTokens(existingUser._id)

        return res
        .status(200)
        .cookie('accessToken', accessToken, {httpOnly: true, secure: true})
        .cookie('refreshToken', refreshToken, {httpOnly: true, secure: true})
        .json(
            new ApiResponse(200, {
                user: existingUser,
                accessToken: accessToken,
                refreshToken: refreshToken
            }, 'Google Authorization successful')
        )

    }
    catch(err){
        logger.error('Google Authorization Error: ', err)
        throw new ApiError(500, 'Google Authorization failed')
    }
})


const logoutUser = asyncHandler(async(req,res,next)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .clearCookie('accessToken',{
        httpOnly: true,
        secure: true
    })
    .clearCookie('refreshToken',{
        httpOnly: true,
        secure: true
    })
    .json(
        new ApiResponse(200,{},'User logged out successfully')
    )
})

const refreshAccessToken = asyncHandler(async(req,res,next)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,'Unauthorized Request')
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select('+refreshToken')

        if(!user){
            throw new ApiError(401,'Invalid Refresh Token')
        }

        if(incomingRefreshToken!==user.refreshToken){
            throw new ApiError(401,'Refresh Token is expired or used')
        }

        const {accessToken,refreshToken} = await generateTokens(user._id)

        return res
        .status(200)
        .cookie('accessToken',accessToken,{
            httpOnly:true,
            secure:true
        })
        .cookie('refreshToken',refreshToken,{
            httpOnly:true,
            secure:true
        })
        .json(
            new ApiResponse(
                200,
                {
                    accessToken:accessToken,
                    refreshToken:refreshToken
                },
                'Access token refreshed'
            )
        )

    }
    catch(err){
        logger.error('Invalid Refresh Token ',err?.message)
        throw new ApiError(401, err?.message || "Invalid refresh token")
    }
})

const chnageCurrentPassword = asyncHandler(async(req,res,next)=>{
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id).select('+password')

    if(!user){
        throw new ApiError(401,'Unauthorized Request')
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,'Invalid Current Password')
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},'Password Changed Successfully')
    )
})

const getCurrentUser = asyncHandler(async(req,res,next)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200,req.user,'User fetched successfully')
    )
})

const updateAccountDetails = asyncHandler(async(req,res,next)=>{
    const {fullName, email} = req.body

    if(!fullName && !email){
        throw new ApiError(400,'Fields cannot be empty')
    }

    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (email) updates.email = email;

    const user = await User.aggregate([
        {
            $match:{
                _id:req.user?._id
            }
        },
        {
            $set:{
                ...updates 
            }
        },
        {
            $merge:{
                into:'users',
                whenMatched:'replace',  // merge changes with existing document
                whenNotMatched:'discard' // don't insert new document if not matched
            }
        }
    ])

    res
    .status(200)
    .json(
        new ApiResponse(200,{},'User details updated successfully')
    )

})

const updateUserAvatar = asyncHandler(async(req,res,next)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,'Avatar file missing')
    }

    const user = await User.findById(req.user?._id)

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const url = user.avatar

    const public_id = url.split('/')[url.split('/').length-1].split('.')[0]

    const deleteResponse = await deleteFromCloudinary(public_id)

    if(!deleteResponse){
        throw new ApiError(500,'File deletion failed')
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar){
        throw new ApiError(500,'Error while uploading file')
    }

    user.avatar = avatar.url

    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            await User.findById(user._id).select('-password -refreshToken'),
            "Avatar image updated successfully"
        )
    )
})


export {
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
}