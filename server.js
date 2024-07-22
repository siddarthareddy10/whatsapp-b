//importing
import express from 'express';
import mongoose from 'mongoose';
import Messages from './dbMessages.js';
import Pusher from 'pusher';
import cors from 'cors';
//app config
const app=express();
const port = process.env.PORT || 9000;

const pusher = new Pusher({
    appId: "1832108",
    key: "f9b6ea623ddb2d6853c3",
    secret: "0129cc6b92a891b9dc3b",
    cluster: "ap2",
    useTLS: true
  });

//middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000'
  }));



//DB config

const connectionString="mongodb+srv://siddartha10:Siddartha%4010@cluster0.tl1wd4o.mongodb.net/whatsapp?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(connectionString);

const db=mongoose.connection

db.once("open" , ()=>{
    console.log("DB connected");

    const msgCollection=db.collection('whatsapps');
    const changeStream= msgCollection.watch();
    changeStream.on('change', (change) =>{
      console.log(change)
        if (change.operationType === 'update') {
            const updatedFields = change.updateDescription.updatedFields;
            const messagesKey = Object.keys(updatedFields).find(key => key.startsWith('messages'));
            if (messagesKey) {
             const latestMessage = updatedFields[messagesKey];
            
              if (latestMessage) {
                console.log(latestMessage.length,"llll")
                pusher.trigger('messages', 'updated', [latestMessage,change.documentKey._id]);
              }
            }
          } 
            else if(change.operationType === 'insert'){
            const messageDetails= change.fullDocument;
            pusher.trigger("messages" , "inserted", {
                _id:messageDetails._id,
                group_name: messageDetails.group_name,
                admin:messageDetails.admin,
                messages: messageDetails.messages,
            });
        }
        else if(change.operationType==='delete'){
            pusher.trigger("messages" , "deleted", {
                id:change.documentKey._id
            });
        }else{
            console.log("error triggering pusher");
        }
    })

})


//??



//api routes
app.get('/', (req,res) => res.send("Hello"));

app.post('/messages/new', async (req, res) => {
    try {
        const newMessage=req.body.messages;
        const group = await Messages.findByIdAndUpdate(
            req.body.id,
            { $push: { messages: newMessage } },
            { new: true, useFindAndModify: false }
          );
        res.status(201).send(group);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/groups/new', async (req, res) => {
    try {
        const newMessage = new Messages(req.body);
        const savedMessage = await newMessage.save();
        res.status(201).send(savedMessage);
    } catch (err) {
        res.status(500).send(err);
    }
});

// API route to get all messages
app.get('/groups/sync', async (req, res) => {
    try {
        const messages = await Messages.find();
        res.status(200).send(messages);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.get('/group/:id', async (req, res) => {
  const { id } = req.params; // Extract the id from req.params
  try {
    const group = await Messages.findById(id);
    if (!group) {
      return res.status(404).send({ message: 'Group not found' });
    }
    res.status(200).send(group);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.post('/find-group', async (req, res) => {
    try {
        const { group_name } = req.body;
    
        // Validate that the group_name is provided
        if (!group_name) {
          return res.status(400).json({ error: 'Group name is required' });
        }
    
        // Find documents with the specified group_name
        const groups = await Messages.find({ group_name });
    
        // Check if any groups were found
        if (groups.length === 0) {
          return res.status(404).json({ message: 'No groups found with the specified name' });
        }
    
        // Return the found groups
        res.status(200).json(groups);
      } catch (err) {
        console.error('Error finding groups:', err);
        res.status(500).json({ error: 'An error occurred while finding groups' });
      }
});
  
app.delete('/groups/:id', async (req, res) => {
    try {
        const groupId = req.params.id;
        console.log(groupId)
        const deletedGroup = await Messages.findByIdAndDelete(groupId);

        if (!deletedGroup) {
            return res.status(404).send({ message: 'Group not found' });
        }

        res.status(200).send({ message: 'Group deleted successfully', deletedGroup });
    } catch (err) {
        res.status(500).send({ message: 'Error deleting group', error: err });
    }
});

app.delete('/groups/:groupId/messages/:messageIndex', async (req, res) => {
    const { groupId, messageIndex } = req.params;
  
    try {
      // Find the group by groupId
      const group = await Messages.findById(groupId);
  
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
  
      // Ensure messageIndex is within bounds
      if (messageIndex <= 0 || messageIndex >= group.messages.length) {
        return res.status(400).json({ message: 'Invalid message index' });
      }
  
      // Remove the message at the specified index
      group.messages.splice(messageIndex, 1);
  
      // Save the updated group
      await group.save();
  
      res.status(200).json({ message: 'Message deleted successfully', group });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

//listen
app.listen(port, console.log(`server is listening on ${port}`));