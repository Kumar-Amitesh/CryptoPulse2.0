import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const oauthSchema = new Schema({
  isOauth: {
    type: Boolean,
    default: false
  },
  provider: {
    type: String,
    default: null
  },
  providerId: {
    type: String,
    required: function () {
      return this.isOauth;
    },
    unique: true,
    default: null
  },
  providerRefreshToken: {
    type: String,
    default: null
  }
}, { _id: false }); 

const userSchema = new Schema({
    username:{
        type: String,
        required: [true, 'Username is required'],
        minlength: [3, 'Username must be at least 3 characters long'],
        unique: [true, 'Username already exists'],
        maxlength: [20, 'Username must be at most 20 characters long'],
        lowercase: true,
        trim: true,
        index: true
    },
    email:{
        type: String,
        required: [true, 'Email is required'],
        unique: [true, 'Already registered'],
        lowercase: true,
        trim: true,
        validate:{
            validator: function(value) {
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    fullName:{
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    avatar:{
        type: String    
    },
    password:{
        type: String,
        required: [true, 'Password is required'],
        select: false, 
    },
    refreshToken:{
        type: String,
        select: false, 
    },
    oauth:{
        type: oauthSchema,
        select: false
    }
}, {
    timestamps: true,
    Collection: 'users'
});


userSchema.pre('save', async function(next){
    if(!this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password,10)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken = function (){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
const User = mongoose.model("User",userSchema)
export default User 