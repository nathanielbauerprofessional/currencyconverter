const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = `mongodb+srv://${process.env.LOGIN}:${process.env.PASSWORD}@cluster0.z2qpc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri);

async function checkUsernameFound(username) {
  try {
    await client.connect();
    const collection = client.db("CURRENCY_CONVERTER").collection("USERS");
    const user = await collection.findOne({ username });
    return user;
  } finally {
    await client.close();
  }
}

async function addUserPassToDatabase(userPass) {
  try {
    await client.connect();
    const collection = client.db("CURRENCY_CONVERTER").collection("USERS");
    await collection.insertOne(userPass);
  } finally {
    await client.close();
  }
}

async function checkIfUserIsAdmin(username) {
  try {
    await client.connect();
    const collection = client.db("CURRENCY_CONVERTER").collection("USERS");
    const user = await collection.findOne({ username });
    return user && user.admin === true;
  } finally {
    await client.close();
  }
}

async function getAllUsers() {
  try {
    await client.connect();
    const collection = client.db("CURRENCY_CONVERTER").collection("USERS");
    return await collection.find({}, { projection: { password: 0 } }).toArray();
  } finally {
    await client.close();
  }
}

module.exports = {
  checkUsernameFound,
  addUserPassToDatabase,
  checkIfUserIsAdmin,
  getAllUsers,
};
