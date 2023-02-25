/* jshint esversion: 9 */
import dotenv from 'dotenv';
dotenv.config();
import Keyv from 'keyv';
const keyv_message = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'gpt_message' });
const keyv_secret = new Keyv(process.env.MESSAGE_STORE_KEYV, { namespace: 'users_api_key' });

const conversationMap = {};
let conversationTimeLimit = parseInt(process.env.CONVERSATION_MEMORY_SECONDS) * 1000;
console.log("conversationTimeLimit: ", conversationTimeLimit);
if(!conversationTimeLimit || conversationTimeLimit <= 0){
    conversationTimeLimit = 300000;
}

async function getConversation(userid, ids = false){
    let conversation = {
        conversationId: undefined,
        parentMessageId: undefined,
        api_key: undefined
    };

    if(ids!=false) {
        let api_key = await keyv_secret.get(userid);
        conversation = {
            conversationId:ids.conversationId,
            parentMessageId:ids.parentMessageId,
            api_key
        };
        conversation.newConversation = false;
        conversation.lastSeen = Date.now();
        conversationMap[userid] = conversation;
    } else if(conversationMap[userid]){
        conversation = conversationMap[userid];
        conversation.newConversation = false;
    }else{
        try {
            let user_msg = await keyv_message.get(userid);
            let api_key = await keyv_secret.get(userid);
            if (api_key == undefined) {
                return {
                    err: "尚未設定 API-Key！\n請使用 `/` 指令完成 `個人API-Key` 設定。"
                };
            } else if (user_msg != undefined) {
                conversationMap[userid] = {
                    conversationId: user_msg.conversationId,
                    parentMessageId: user_msg.parentMessageId,
                    api_key
                };
                conversation.newConversation = false;
            } else {
                conversation.api_key = api_key;
                conversationMap[userid] = conversation;
                conversation.newConversation = true;
            }
        }
        catch(err) {
            console.log(err);
            conversationMap[userid] = conversation;
            conversation.newConversation = true;
        }
    }

    conversation.lastSeen = Date.now();
    
    return conversation;
}

function resetConversation(userid){
    delete conversationMap[userid];
}

function cleanUnactiveConversations(){
    
    try{
        const users = Object.keys(conversationMap);
        users.forEach((user)=>{
            const lastSeen = conversationMap[user].lastSeen;
            if(Date.now()-lastSeen-conversationTimeLimit >= 0){
                delete conversationMap[user];
            }
        })
    }catch(e){

    }finally{
        setTimeout(cleanUnactiveConversations,60000);
    }
}

cleanUnactiveConversations();

export default {
    getConversation,
    resetConversation
};