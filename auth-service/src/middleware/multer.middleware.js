// Multer is a node.js middleware for handling multipart/form-data, which is primarily used for uploading files.
// Multer adds a body object and a file or files object to the request object. The body object contains the values of the text fields of the form, the file or files object contains the files uploaded via the form.

import multer from 'multer'

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,'.././public/temp')
    },
    filename: function(req,file,cb){
        cb(null,file.originalname)
    }
})

const upload = multer({storage})
export default upload