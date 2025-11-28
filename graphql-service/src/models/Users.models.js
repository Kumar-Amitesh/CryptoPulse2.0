import mongoose, { Schema } from 'mongoose';

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

const User = mongoose.model("User",userSchema)
export default User 