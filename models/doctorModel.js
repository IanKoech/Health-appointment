// const mongoose = require('mongoose');
import mongoose from "mongoose";
const doctorSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true
        },
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        phoneNumber: {
            type: String,
            required: true
        },
        website: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        specialization: {
            type: String,
            required: true
        },
        experience: {
            type: String,
            requried: true
        },
        consultationFees: {
            type: Number,
            required: true
        },
        tillNumber: {
            type: Number,
            required: true,
       },
        timings: {
            type: Array,
            required: true
        },
        status: {
            type: String,
            default: 'pending'
        }
    },
    {
        timestamps: true
    }
);

const doctorModel = mongoose.model('doctors', doctorSchema);

// module.exports = doctorModel;

export default doctorModel;