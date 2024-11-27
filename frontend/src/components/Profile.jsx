import React, { useEffect, useState } from 'react'
import LogoutIcon from '@mui/icons-material/Logout';
import { UserAuth } from '../context/AuthContext';
import { UserDetails } from '../context/UserContext';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { FaUserFriends } from "react-icons/fa";
import DoneIcon from '@mui/icons-material/Done';
import CloseIcon from '@mui/icons-material/Close';

export default function Profile(props) {
  
  const {logOut} = UserAuth();
  const{user,profileDetails,createRequest,verdictRequest,fetchSearchedDetails} = UserDetails();

  const [connectedType,setConnectedType] = useState(null);

  async function handleConnectRequest (){
      if(user && profileDetails && user.UserId===profileDetails.UserId)return;

      
      if(user && profileDetails && user.UserName !==profileDetails.UserName){
          const response = await createRequest(user.UserName,profileDetails.UserName);
          if(response ){
              if(response.status ===200){
                setConnectedType("requestMade");
              }
          }
      }
  }
  async function handleAccept(){
    if(user && profileDetails && user.UserId===profileDetails.UserId)return;
    if(profileDetails && profileDetails.UserName){
        const result = await verdictRequest(profileDetails.UserName,true);
        if(result && result.status ===200){
          setConnectedType("connected");
        }
    }
    
  }
  async function handleReject(){
    if(user && profileDetails && user.UserId===profileDetails.UserId)return;
    if(profileDetails && profileDetails.UserName){
      const result = await verdictRequest(profileDetails.UserName,false);
      if(result && result.status ===200){
        setConnectedType("addConnection");
      }
    }
  }



  useEffect(()=>{
    
    if (profileDetails === null) return;

    if(profileDetails.connected){
      setConnectedType("connected");
    }else if(profileDetails.requestCame){
      setConnectedType("requestCame");
    }else if(profileDetails.requestMade){
      setConnectedType("requestMade");
    }else if(user.UserId !== profileDetails.UserId) {
      console.log("user",user);
      console.log("profile",profileDetails);
      setConnectedType("addConnection");
    }else{
      setConnectedType(null);
    }
    
  },[profileDetails]);

  useEffect(()=>{
    if(!profileDetails && props.UserName){
      fetchSearchedDetails(props.UserName);
    }
  },[]);
  
  return (
    <div className='w-full flex flex-col'>
    <div className='flex flex-col items-center justify-center w-full flex-grow'>
      <div>
      <img src={profileDetails && profileDetails.ProfilePic?profileDetails.ProfilePic:null}
           className='w-40 rounded-full'
           alt='profile-pic'
      />
      </div>
      <p>{profileDetails && profileDetails.Name}</p>
      <p>{profileDetails && profileDetails.Email}</p>
      <p>Connections: {profileDetails && profileDetails.Contacts.length}</p>


      {connectedType && connectedType==="connected"?
      <div>
        <button disabled className='bg-green-400 rounded-full p-2  px-3 flex items-center'><FaUserFriends/>Connected</button>
      </div>:<></>}

      {connectedType && connectedType==="requestCame"?
      <div className='flex flex-wrap'>
        <button onClick={handleAccept}
         className='bg-green-400 rounded-full p-2  px-3 m-2 flex items-center'><DoneIcon/> Accept
        </button>
        <button onClick={handleReject}
         className='bg-red-400 rounded-full p-2  px-3 m-2 flex items-center'><CloseIcon/> Reject
        </button>
      </div>:<></>}
      
      {connectedType && connectedType==="requestMade"?
      <div>
        <button disabled className='bg-gray-400 rounded-full p-2  px-3 flex items-center'><AccessTimeIcon/> requested</button>
      </div>:<></>}

      {connectedType && connectedType==="addConnection"?
      <div>
        <button className='bg-green-500 rounded-full p-2 px-3 flex items-center' 
        onClick={handleConnectRequest}>
          Add Connection <AddIcon/>
        </button>
      </div>:<></>}

    </div>

    {user && profileDetails &&  user.UserId===profileDetails.UserId?
      <div>
        <button className='text-red-500 font-semibold p-3 transition hover:scale-105 float-right m-2'
                onClick={logOut}
        >
          <LogoutIcon sx={{marginRight:"5px"}}/>
            Log Out
        </button>
      </div>:<></>}
      
    </div>
  )
}
