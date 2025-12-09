import multer from 'multer'
import path from 'path'
import fs from 'fs'

const storage = multer.diskStorage({
    destination: function(req,file,cb){
        // cb(null,'.././public/temp')
        // path.resolve('/public/temp')
        const uploadPath = path.join(process.cwd(), 'public', 'temp'); 
        // console.log('Upload Path:', uploadPath);
        // Check if directory exists, if not, create it
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath)
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