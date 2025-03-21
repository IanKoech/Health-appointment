// const mongoose = require('mongoose');
import mongoose from "mongoose";
mongoose.connect(process.env.MONGO_URL);

const connection = mongoose.connection;

connection.on('connected', ()=>{
    console.log('Mongo db connected');
});

connection.on('error', (error)=>{
    console.log("Error :",error);
})

// module.exports = mongoose;

export default mongoose;