import multer from 'multer'
import path from 'path'

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        cb(null,'.././public/temp')
        // path.resolve('/public/temp')
    },
    filename: function(req,file,cb){
        // cb(null,file.originalname)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);

        cb(null, `${uniqueSuffix}${fileExtension}`)
    }
})

const upload = multer({storage})
export default upload