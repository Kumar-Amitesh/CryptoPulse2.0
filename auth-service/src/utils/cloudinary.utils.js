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
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(filePath,{
            resource_type: 'auto'
        })
        // file has been uploaded successfull
        // console.log("file is uploaded on cloudinary response ", response);

        // Delete only if it's a local file (not a URL)
        if (!filePath.startsWith("http") || !filePath.startsWith("https")) {
            fs.unlinkSync(filePath);
        }
        return response;
    }
    catch(error){
        logger.error("Cloudinary upload error:", error)
        //fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        // Try to delete only if it's a local file
        if (!filePath.startsWith("http") || !filePath.startsWith("https")) {
            try { fs.unlinkSync(filePath); } catch (err) {}
        }
        return null
    }
}

const deleteFromCloudinary = async function(public_id){
    try{
        if(!public_id) return null

        //delete from cloudinary
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


// Response example
// {
//   asset_id: '843cc951bfaa0406ab46c4a511be352f',
//   public_id: 'happy_people',
//   format: 'jpg',
//   version: 1651585298,
//   resource_type: 'image',
//   type: 'upload',
//   created_at: '2022-05-03T13:41:38Z',
//   bytes: 305948,
//   width: 1920,
//   height: 1279,
//   access_mode: 'public',
//   url: 'http://res.cloudinary.com/demo/image/upload/v1651585298/happy_people.jpg',
//   secure_url: 'https://res.cloudinary.com/demo/image/upload/v1651585298/happy_people.jpg',
//   next_cursor: 'be5b96157f04cc1ca17ae170f3120d72b33014b52e696d728eaf0334524d9fe2',
//   derived: [],
//   colors: [
//     [ '#F8F3F0', 27.8 ], [ '#DBE0EA', 12 ],
//     [ '#D9DBC0', 11.5 ], [ '#CA9379', 9.9 ],
//     [ '#85553F', 9.2 ],  [ '#EAF1F6', 8 ],
//     [ '#B6CA75', 4.4 ],  [ '#CCD787', 3.3 ],
//     [ '#6F8049', 3.1 ],  [ '#4A2C1E', 1.2 ],
//     [ '#404727', 1.1 ],  [ '#8F7C7B', 0.9 ],
//     [ '#CDB588', 0.7 ],  [ '#627463', 0.7 ],
//     [ '#42200B', 0.6 ],  [ '#E1DDE1', 0.6 ]
//   ],
//   pages: 1,
//   usage: {},
//   original_filename: 'happy_people',
//   etag: 'a05e4b2dead1465657e9cfc0ab1de643',
//   rate_limit_allowed: 10000,
//   rate_limit_reset_at: 2022-05-03T14:00:00.000Z,
//   rate_limit_remaining: 9719
// }