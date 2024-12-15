const { MongoClient } = require('mongodb');
require("dotenv").config();
const uri = `mongodb+srv://${process.env.LOGIN}:${process.env.PASSWORD}@cluster0.z2qpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri);



async function removeAllUsers(){
    try {
        const collection = client.db('CURRENCY_CONVERTER').collection('USERS')
        const result = await collection.deleteMany({});
        console.log(result);
        return result;
    } catch (error) {
        console.error("ERROR", error);
        throw error;
      }
}


removeAllUsers();