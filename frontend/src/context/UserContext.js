import { createContext, useContext, useEffect, useState } from "react";
import { UserAuth } from "./AuthContext";
import { handleCreateRequest, handleFetchUserDetails, handleSearchedUserDetails,handleFetchRequests, handleRequestVerdict, handleFetchChat, handleUpdateChat } from "../services/api";
import { useUtils } from "./UtilsContext";


const userContext = createContext();

function UserProvider({children}){
    const [user, setUser] = useState(JSON.parse(localStorage.getItem("varta-profile")));
    const [window,setWindow] = useState(null);
    const [profileDetails,setProfileDetails] = useState(null);
    const [requests,setRequests] = useState(null);
    const [chatWithId,setChatWithId] = useState(null);
    const [chatDetails,setChatDetails] = useState(null);
    const [recentChats,setRecentChats] = useState(null);
    const {token} = UserAuth();
    const {setClearFunctions} = useUtils();

    async function fetchUserDetails() {
        if (token) {
            const userData = await handleFetchUserDetails(token);
            if (userData.status === 200) {
                // Set the user details using setUser function
                setUser(userData.message);
                setRecentChats(userData.recentChats);
                setProfileDetails(userData.message);
                localStorage.setItem("varta-profile", JSON.stringify(userData.message));
                return {status:200,result:userData.message};
            }
        }
    }

    async function fetchSearchedDetails(username){
        if (!user) return;

        if(user && user.UserName === username){
            const response = await fetchUserDetails();
            if(response && response.status === 200){
                setProfileDetails(response.result);
                setWindow("Profile");
                return;
            }
            if(response)return;
        }

        if(user.UserName !== username){
            const response = await handleSearchedUserDetails(user.UserName,username,token);
            if(response){
                setProfileDetails(response.message);
                setWindow("Profile");
            }
        }
    }

    async function createRequest(UserNameFrom,UserNameTo){
        const response = await handleCreateRequest(UserNameFrom,UserNameTo,token);
        if(response && response.status===200){
            return response;
        }
    }

    async function fetchRequests(username){
        const response = await handleFetchRequests(username,token);
        if(response){
            if(response.status === 200){
                setRequests(response.message);
            }
        }
    }

    async function fetchContacts(){
        await fetchUserDetails();
    }

    async function verdictRequest(From,Verdict){
        const To = user.UserName;
        const response = await handleRequestVerdict(From,To,Verdict,token);
        if(response ){
            fetchUserDetails();
            return response;
        }
    }
    
    async function fetchChat(){
        if(chatWithId){
            const response = await handleFetchChat(user.UserId,chatWithId,token);
            if(response && response.status === 200){
                setChatDetails(response.message);
            }
        }
    }

    async function updateChat(chatWithId,message){
        if(user && chatWithId && message && token){
            const result = await handleUpdateChat(user.UserId,chatWithId,message,token);
            if(result){
                return {status:result.status,message:result.message};
            }
        }
    }

    useEffect(()=>{
        setClearFunctions(
            [setUser,
            setWindow,
            setProfileDetails,
            setRequests,
            setChatWithId,
            setChatDetails,
            setRecentChats]
        );
    },[]);
    return (
        <userContext.Provider
            value={{
                fetchUserDetails,
                window,setWindow,
                user,
                fetchSearchedDetails,
                profileDetails,setProfileDetails,
                createRequest,
                requests,
                fetchRequests,
                verdictRequest,
                fetchContacts,
                chatWithId,setChatWithId,
                chatDetails,setChatDetails,
                fetchChat,
                updateChat,
                recentChats,setRecentChats
            }}
        >
            {children}
        </userContext.Provider>
    );
}

function UserDetails(){
    return useContext(userContext);
}

export {UserDetails,UserProvider};