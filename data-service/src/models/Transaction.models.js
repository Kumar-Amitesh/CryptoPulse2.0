import mongoose, { Schema } from 'mongoose';

const transactionSchema = new Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    coinId: {
        type: String, 
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['buy', 'sell'], 
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: [0, 'Quantity cannot be negative'] 
    },
    pricePerCoin: {
        type: Number, 
        required: true,
        min: [0, 'Price cannot be negative']
    },
    transactionDate: {
        type: Date,
        default: Date.now, 
        required: true
    }
}, { timestamps: true }); 

// Compound index if you frequently query user + coin + date ranges
// transactionSchema.index({ user: 1, coinId: 1, transactionDate: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;