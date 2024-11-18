import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";

import authModel from "../models/authModel.js";
import userModel from "../models/userModel.js";
import chatModel from "../models/chatModel.js";
import { setCacheData, getCacheData, deleteCachedKey } from "../util/redisImplementation.js";

import dotenv from "dotenv";
dotenv.config();


function sortByLastMessageTimeStamp(a, b) {
    const val =   a.lastMessage.TimeStamp - b.lastMessage.TimeStamp;
    return val;
}

export const handleRegister = async(req,res)=>{
    const data = req.body;
    try {
        const {Email,Name,Password,ProfilePic,UserName,Contacts} = data;
        if(!(Email && Name && Password && UserName)){
            return res.status(404).json({message:"Please fill required fields."});
        }

        const foundEmail = await authModel.findOne({Email});
        if(foundEmail){
            return res.status(404).json({message:"User Already Exists."});
        }

        const foundUserName = await userModel.findOne({ UserName: { $regex: new RegExp(UserName, 'i') } }) !==null;
        if(foundUserName){
            return res.status(404).json({message:"UserName already Taken."});
        }
        
        const saltRounds = 10; // Example value, adjust as needed
        const hashedPassword = await bcrypt.hash(Password, saltRounds);
        
        const newAuth = new authModel({
            Email,
            'Password':hashedPassword
        });
        const newUser = new userModel({
            Email,Name,UserName,ProfilePic,Contacts,UserId:newAuth._id
        });
        const newChat = new chatModel({
            UserName,Name,UserId:newAuth._id,ProfilePic
        });

        
        await newUser.save();
        await newChat.save();
        await newAuth.save();

        return res.status(200).json({message:"User created."});
        
    } catch (error) {
        console.log("register Route Error:",error.message);
        return res.status(404).json({message:"Internal Server Error."});
    }
}

export const handleLogIn = async(req,res)=>{
    const {Email,Password} = req.body;
    if(!Email || !Password){
        return res.status(404).json({message:"Email and Password are necessary."});
    }
    try {
        const authUser = await authModel.findOne({Email});
        if(!authUser){
            return res.status(404).json({message:"User not registered."});
        }
        
        const isValidPassword = await bcrypt.compare(Password,authUser.Password);
        
        if(!isValidPassword){
            return res.status(401).json({message:"Invalid Password."});
        }

        const jwt_secret = process.env.JWT_SECRET;
        const token = jwt.sign({ userId: authUser._id }, jwt_secret);

        // adding cookie
        res.cookie('varta-auth',token,{
            maxAge: 3600000, // 1 hour in milliseconds
        });

        return res.status(200).json({message:"Log In successful.",jwt:token});
    } catch (error) {
        return res.status(500).json({message:error.message});
    }
}

export const handleUserDetails=async(req,res)=>{
    const _id = req.user_id;
    const redisKey = 'user:'+_id;
    try {
        // redis{user+_id : {recentChats,userData}}
        const cacheResult = await getCacheData(redisKey);
        if(cacheResult == null){
            const userData = await userModel.findOne({UserId:_id}).select();
            if(userData === null) return res.status(404).json({message:"not found"});
            const chatsQuery = await chatModel.findOne({UserId:_id}).select('Chats');
            const recentChats = []; 
            
            if(chatsQuery){
                const chats = chatsQuery.Chats;
                
                for(let i=0;i<chats.length;i++){
                    if(chats[i].conversation.length!==0){
                        const curr = {
                            UserName:chats[i].UserName,
                            UserId:chats[i].UserId,
                            Name:chats[i].Name,
                            ProfilePic:chats[i].ProfilePic,
                            lastMessage:chats[i].conversation[chats[i].conversation.length-1]
                        }
                        recentChats.push(curr);
                    }
                }
                recentChats.sort(sortByLastMessageTimeStamp);
            }
            
            const result = {message:userData,recentChats};
            setCacheData(redisKey,result);
            
            return res.status(200).json(result);
        }else{
            return res.status(200).json(cacheResult);
        }
    } catch (error) {
        console.log("error:",error.message);
        return res.status(404).json({message:error.message});
    }
}

export const handleSearchedUser = async (req, res) => {
    try {
        const searchedUser = req.body.searchedUser;
        const redisKey = 'searchedUser:'+searchedUser;
        const cachedSearchedUser = await getCacheData(redisKey);

        if(cachedSearchedUser==null){
            const searchedUserDetail = await userModel.find({ 
                Name: { $regex: new RegExp(searchedUser, 'i') } 
            }).limit(10).select('UserId Name UserName ProfilePic');

            const result = {message:searchedUserDetail};
            setCacheData(redisKey,result);
            return res.status(200).json(result);

        }else{
            const result = cachedSearchedUser;
            return res.status(200).json(result);
        }

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Internal Server Error' }); // Handle errors appropriately
    }
};

export const handleSearchedUserDetails = async(req,res) =>{
    const {searchedUserName,currentUserName} = req.body;
    const redisKey = 's_user:'+searchedUserName+'c_user:'+currentUserName;
    console.log(redisKey);
    try {
        if(searchedUserName == null){
            return res.status(404).json({message:"searchedUserName is necessary."});
        }
        const cachedData = await getCacheData(redisKey);

        if(cachedData != null){
            const result = cachedData;
            return res.status(200).json(result);
        }

        const userDetails = await userModel.findOne({UserName:searchedUserName});
        
        if(userDetails == null){
            return res.status(404).json({message:"Details Not found."});
        }
        const requestMade = await chatModel.findOne({UserName:currentUserName, 'RequestsSent.UserName': searchedUserName }) !==null;
        const requestCame = await chatModel.findOne({UserName:currentUserName, 'RequestsReceived.UserName':searchedUserName}) !==null;
        const connected = await userModel.findOne({UserName:currentUserName,'Contacts.contactUserName':searchedUserName}) !==null;
        const queryRes = { ...userDetails.toObject(), requestMade,connected,requestCame };

        const result = {message:queryRes};
        setCacheData(redisKey,result);

        return res.status(200).json(result);

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
}

export const handleCreateRequest = async (req,res)=>{

    const {userNameFrom,userNameTo} = req.body;
    // remove redis key so that cached result are not sent when fetching requests received by userNameTo
    const redisKeyToRemove = "requestsTo:"+userNameTo;
    if (!userNameFrom || !userNameTo) {
        return res.status(404).json({ message: "userNameFrom and userNameTo are required" });
    }
    if(userNameFrom === userNameTo){
        return res.status(404).jsons({message:"Can not send request to itself."});
    }
    try {
        //deleting from cache
        deleteCachedKey(redisKeyToRemove);

        const chatFromDetails = await chatModel.findOne({ UserName: userNameFrom });
        const chatToDetails = await chatModel.findOne({ UserName: userNameTo });
        const picData = await userModel.findOne({ UserName: userNameFrom }).select('ProfilePic');
        if (!chatFromDetails || !chatToDetails) {
            return res.status(404).json({ message: "User not found" });
        }
        
        const alreadyPresent = await chatModel.findOne({ UserName:userNameFrom,'RequestsSent.UserName': userNameTo });
        if(alreadyPresent){
            return res.status(404).json({message:"Request already made."});
        }
        
        chatFromDetails.RequestsSent.push({
            Name: chatToDetails.Name,
            UserName: userNameTo,
        });
        chatToDetails.RequestsReceived.push({
            Name: chatFromDetails.Name,
            UserName: userNameFrom,
            ProfilePic:picData.ProfilePic
        });
        
        const result1 = await chatFromDetails.save();
        const result2 = await chatToDetails.save();
        
        return res.status(200).json({ message: "Request sent successfully" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
}

export const handleFetchRequests = async(req,res)=>{
    const {UserName} = req.body;
    if(!UserName)return res.status(404).json({message:"Username's data not found"});

    const redisKey = "requestsTo:"+UserName;

    try {
        const cachedData = await getCacheData(redisKey);
        if(cachedData != null){
            const result = cachedData;
            return res.status(200).json(result);
        }
        const queryRes = await chatModel.findOne({UserName}).select('RequestsReceived');
        const requestReceived = queryRes['RequestsReceived'];
        const result = {message:requestReceived};
        setCacheData(redisKey,result);
        return res.status(200).json(result);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
}

export const handleRequest = async (req, res) => {
    const { From, To, Verdict } = req.body;

    const redisKeyToRemove1 = "requestsTo:"+To;

    try {
        //deleting cache
        deleteCachedKey(redisKeyToRemove1);

        const resultFrom = await chatModel.findOne({ UserName: From });
        const resultTo = await chatModel.findOne({ UserName: To });
        if (resultFrom === null || resultTo === null) {
            return res.status(404).json({ fromExists: resultFrom !== null, toExists: resultTo !== null });
        }
        //removing cache of user:userid that consists of requests in chatmodel
        const redisKeyToRemove2 = "user:"+resultFrom.UserId;
        const redisKeyToRemove3 = "user:"+resultFrom.UserId;
        deleteCachedKey(redisKeyToRemove2);
        deleteCachedKey(redisKeyToRemove3);

        if(Verdict){
            await userModel.findOneAndUpdate(
                { UserId: resultFrom.UserId },
                {
                    $push: {
                        Contacts: {
                            contactName: resultTo.Name,
                            contactUserName: resultTo.UserName,
                            contactUserId: resultTo.UserId,
                            contactProfilePic:resultTo.ProfilePic
                        }
                    }
                }
            ).lean();
    
            await userModel.findOneAndUpdate(
                { UserId: resultTo.UserId },
                {
                    $push: {
                        Contacts: {
                            contactName: resultFrom.Name,
                            contactUserName: resultFrom.UserName,
                            contactUserId: resultFrom.UserId,
                            contactProfilePic:resultFrom.ProfilePic
                        }
                    }
                }
            ).lean();

            await chatModel.findOneAndUpdate(
                { UserId: resultFrom.UserId },
                {
                    $push: {
                        Chats: {
                            Name: resultTo.Name,
                            UserName: resultTo.UserName,
                            UserId: resultTo.UserId,
                            ProfilePic:resultTo.ProfilePic
                        }
                    }
                }
            ).lean();
    
            await chatModel.findOneAndUpdate(
                { UserId: resultTo.UserId },
                {
                    $push: {
                        Chats: {
                            Name: resultFrom.Name,
                            UserName: resultFrom.UserName,
                            UserId: resultFrom.UserId,
                            ProfilePic:resultFrom.ProfilePic
                        }
                    }
                }
            ).lean();
        }

        await chatModel.findOneAndUpdate(
            { UserName: From },
            { $pull: { RequestsSent: { UserName: To } } }
        ).lean();

        await chatModel.findOneAndUpdate(
            { UserName: To },
            { $pull: { RequestsReceived: { UserName: From } } }
        ).lean();

        return res.status(200).json({ message: "connected" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

export const handleFetchingChat = async (req,res)=>{
    const {userId,chatWithId} = req.body;
    const redisKey = "chat-user:"+userId+"chatWithId"+chatWithId;
    try {
        if(!userId || !chatWithId) return res.status(404).status({message:"FromId to ToId required"});
        const cachedData = await getCacheData(redisKey);
        if(cachedData != null){
            const result = cachedData;
            return res.status(200).json(result);
        }

        const chatWithQuery = await chatModel.findOne({ "UserId": userId }).select('Chats');
        if(chatWithQuery){
            const targetChat = chatWithQuery.Chats.find(chat => chat.UserId === chatWithId);
            const {
                UserId:chatWithUserId,
                UserName:chatWithUserName,
                Name:chatWithName,
                ProfilePic:chatWithProfilePic
            } = targetChat;
            const last100Messages = targetChat.conversation.slice(-100);
            const chatWithDetails ={chatWithUserId,chatWithUserName,chatWithName,chatWithProfilePic,last100Messages};
            const result = {message:chatWithDetails};
            //caching
            setCacheData(redisKey,result);
            return res.status(200).json(result);
        }
        if(!chatWithQuery){
            return res.status(404).json({message:"Chats data not available for this UserId"});
        }
    } catch (error) {
        return res.status(500).json({message:"Internal Server Error."});
    }
}

export const handleUpdatingChat=async (req,res)=>{
    const {chatWithId,UserId,message}=req.body;

    const redisRemoveKey1 = "chat-user:"+UserId+"chatWithId"+chatWithId;
    const redisRemoveKey2 = "chat-user:"+chatWithId+"chatWithId"+UserId;
    
    try {
        if(!chatWithId || !UserId || !message){
            return res.status(404).json({message:"Need chatWithId,UserId,message"});
        }

        //delete caches
        deleteCachedKey(redisRemoveKey1);
        deleteCachedKey(redisRemoveKey2);

        const conversationData = {
            From:UserId,
            Message:message
        }
        
        const result_From = await chatModel.findOne({ UserId: UserId }).select('Chats');
        const result_To = await chatModel.findOne({ UserId: chatWithId }).select('Chats');

        let TimeStamp = null;
        if (result_From) {
            const index = result_From.Chats.findIndex(chat => chat.UserId === chatWithId);

            if (index !== -1) {
                const targetUser = result_From.Chats[index];

                if (targetUser) {
                    targetUser.conversation.push(conversationData);
                    TimeStamp = targetUser.conversation[targetUser.conversation.length-1].TimeStamp;
                    conversationData['TimeStamp'] = TimeStamp;
                    result_From.markModified('Chats'); // Notify Mongoose about the modification
                    await result_From.save();
                }
            }
        }
        if(result_To){
            const index = result_To.Chats.findIndex(chat => chat.UserId === UserId);
            if(index!==-1){
                const targetUser = result_To.Chats[index];

                if(targetUser){
                    targetUser.conversation.push(conversationData);
                    // console.log(conversationData.TimeStamp);
                    result_To.markModified('Chats');
                    await result_To.save();
                }
            }
        }
        return res.status(200).json({message:conversationData});
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({message:"Internal Server Error."});
    }
}