// CONECION BASE DE DATOS MONGODB //

const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcrypt');

const url = 'mongodb://localhost:27017';
const dbName = 'DataGestion';

const client = new MongoClient(url);

const connectDB = async () => {
  try {
    await client.connect();
    console.log('Conectado a MongoDB');
    const db = client.db(dbName);
    return db;
  } catch (err) {
    console.log(err);
  }
};

const createUserCollection = async (db) => {
    const userC = db.collection("users");
    
    // CREAR CORREO UNICO
    await userC.createIndex({ email: 1 }, { unique: true });

    return userC;
};

module.exports = { 
    connectDB,
    createUserCollection, 
};