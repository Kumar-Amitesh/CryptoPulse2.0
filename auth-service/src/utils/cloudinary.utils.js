import {v2 as cloudinary} from "cloudinary"
import fs from "fs"
import logger from './logger.utils.js'
import dotenv from 'dotenv'

dotenv.config({
    path:'../../.env'
})

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async function(filePath){
    try{
        if(!filePath) return null
        const response = await cloudinary.uploader.upload(filePath,{
            resource_type: 'auto'
        })
        // console.log("file is uploaded on cloudinary response ", response);

        if (!filePath.startsWith("http") || !filePath.startsWith("https")) {
            fs.unlinkSync(filePath);
        }
        return response;
    }
    catch(error){
        logger.error("Cloudinary upload error:", error)
        
        if (!filePath.startsWith("http") || !filePath.startsWith("https")) {
            try { fs.unlinkSync(filePath); } catch (err) {}
        }
        return null
    }
}

const deleteFromCloudinary = async function(public_id){
    try{
        if(!public_id) return null

        const response = cloudinary.uploader.destroy(public_id)

        return response
    }
    catch(error){
        logger.error("Cloudinary delete error: ",error)
        return null
    }
}

export {
    uploadOnCloudinary,
    deleteFromCloudinary
}

