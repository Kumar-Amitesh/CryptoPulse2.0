import mongoose, { Schema } from 'mongoose';

const priceSnapshotSchema = new Schema({
    coinId: {
        type: String,
        required: true,
        index: true
    },
    price: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    marketCap: {
        type: Number
    },
    volume24h: {
        type: Number
    }
}, {
    timestamps: true, 
    collection: 'priceSnapshots' 
});

priceSnapshotSchema.index({ coinId: 1, timestamp: -1 });

const PriceSnapshot = mongoose.model('PriceSnapshot', priceSnapshotSchema);

export default PriceSnapshot;
