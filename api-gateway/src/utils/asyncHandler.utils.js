// import logger from './logger.utils.js'

const asyncHnadler = (requestHandler) => {
    return (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next)).catch((err) =>{
            // logger.error('Error: ',err)
            console.error('Error: ',err)
            next(err)
        })
    }
}

// const asyncHnadler = (fn) => async(req,res,next) => {
//     try{
//         fn(req,res,next)
//     }
//     catch(err){
//         res.status(err.code || 500).json({
//              success: false,
//              message: err.message
//          })
//     }
// }

export default asyncHnadler