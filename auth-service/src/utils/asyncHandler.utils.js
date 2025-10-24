import logger from './logger.utils.js'

const asyncHnadler = (requestHandler) => {
    return (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next)).catch((err) =>{
            logger.error('Error: ',err)
            next(err)
        })
    }
}

export default asyncHnadler