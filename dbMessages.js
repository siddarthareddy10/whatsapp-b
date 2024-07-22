import mongoose from "mongoose";

const whatsappSchema=mongoose.Schema({
    group_name:String,
    admin:String,
    messages:[
    {message:String,
    name:String,
    timeStamp: String,
    senderId: String}],
});

const Messages= mongoose.model('whatsapp', whatsappSchema);
export default Messages;