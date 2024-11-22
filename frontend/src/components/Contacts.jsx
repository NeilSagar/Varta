import React, { useEffect, useState } from 'react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { UserDetails } from '../context/UserContext';
import Contact_x_Chat_card from './Contact_x_Chat_card';

export default function Contacts({setSideBarMainScreen}) {
  const {user} = UserDetails();

  function handleClick(){
    setSideBarMainScreen("chats");
  }


  return (
    <div className='h-[85vh]'>
      <div className='flex items-center shadow-sm p-1 h-[5vh]'>
        <button  onClick={handleClick}
        className='hover:border hover:border-white border border-transparent rounded-full'>
          <ArrowBackIcon sx={{color:"white"}}/>
        </button>
        <h3 className='flex-grow ps-3'>Contacts</h3>
      </div>
      <div className='h-[80vh] overflow-auto'>
      {user && user.Contacts && user.Contacts.map((contact,index)=>{
        const notify = false;
        return(
          <Contact_x_Chat_card 
          key={index} 
          ProfilePic={contact.contactProfilePic} 
          Name={contact.contactName} 
          Secondary={contact.contactUserName}
          notification={notify}
          contactId ={contact.contactUserId}
          setSideBarMainScreen = {setSideBarMainScreen}
          />
        )
      })}
    
      </div>
    </div>
  )
}
