//importing
import express from 'express';
import mongoose from 'mongoose';
import Messages from './dbMessages.js';
import Pusher from 'pusher';
import cors from 'cors';

// App config
const app = express();
const port = process.env.PORT || 9000;

const pusher = new Pusher({
  appId: "1832108",
  key: "f9b6ea623ddb2d6853c3",
  secret: "0129cc6b92a891b9dc3b",
  cluster: "ap2",
  useTLS: true
});

// Middleware
app.use(express.json());
app.use(cors());

// DB config
const connectionString = "mongodb+srv://siddartha10:Siddartha%4010@cluster0.tl1wd4o.mongodb.net/whatsapp?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(connectionString);

const db = mongoose.connection;

// API routes
app.get('/', (req, res) => res.send("Hello"));

//CREATE NEW GROUP
app.post('/groups/new', async (req, res) => {
  try {
    // Create a new message document with the data from the request body
    const newGroup = new Messages(req.body);
    
    // Save the new group to the database
    const savedGroup = await newGroup.save();
    
    // Trigger a Pusher event with the details of the newly created group
    await pusher.trigger("messages", "groupinserted", {
      _id: savedGroup._id,
      group_name: savedGroup.group_name,
      admin: savedGroup.admin,
      messages: savedGroup.messages
    });

    // Send a response with the details of the saved group
    res.status(201).send(savedGroup);
  } catch (err) {
    // Handle errors and send an appropriate response
    res.status(500).send(err);
  }
});

//DELETE GROUP
app.delete('/groups/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    console.log(groupId);
    const deletedGroup = await Messages.findByIdAndDelete(groupId);
    await pusher.trigger("messages", "groupdeleted", {
      id: groupId
    });
    if (!deletedGroup) {
      return res.status(404).send({ message: 'Group not found' });
    }

    res.status(200).send({ message: 'Group deleted successfully', deletedGroup });
  } catch (err) {
    res.status(500).send({ message: 'Error deleting group', error: err });
  }
});

//CREATE NEW MESSAGE
app.post('/messages/new', async (req, res) => {
  try {
    // Extract the new message and group ID from the request body
    const newMessage = req.body.messages;
    const groupId = req.body.id;

    // Find the group by ID and update it with the new message
    const group = await Messages.findByIdAndUpdate(
      groupId,
      { $push: { messages: newMessage } },
      { new: true, useFindAndModify: false }
    );

    // Log the updated group to the console
   
    // Trigger a Pusher event with the updated group data
    await pusher.trigger("messages", "messageinserted", {
      _id: group._id,
      group_name: group.group_name,
      admin: group.admin,
      messages: group.messages
    });

    // Send the updated group data in the response
    res.status(201).send(group);
  } catch (err) {
    // Handle errors and send an appropriate response
    res.status(500).send(err);
  }
});

//DELETE MESSAGE
app.delete('/groups/:groupId/messages/:messageIndex', async (req, res) => {
  const { groupId, messageIndex } = req.params;

  try {
    // Ensure messageIndex is an integer
    const index = parseInt(messageIndex, 10);

    if (isNaN(index)) {
      return res.status(400).json({ message: 'Invalid message index' });
    }

    // Find the group by groupId
    const group = await Messages.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Ensure messageIndex is within bounds
    if (index < 0 || index >= group.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }

    // Remove the message at the specified index
    group.messages.splice(index, 1); 

    // Save the updated group
    await group.save();
    console.log(index,group)
    // Trigger Pusher event with the updated group data
    await pusher.trigger("messages", "messagedeleted", {
      _id: group._id,
      group_name: group.group_name,
      admin: group.admin,
      messages: group.messages
    });

    res.status(200).json({ message: 'Message deleted successfully', group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


//SEND ALL GROUPS
app.get('/groups/sync', async (req, res) => {
  try {
    const messages = await Messages.find();
    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send(err);
  }
});

//SEND SEARCHED GROUPS
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


// Listen
app.listen(port, () => console.log(`Server is listening on port ${port}`));
console.log("DB connected")