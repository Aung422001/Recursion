import mongoose from 'mongoose';
import { mongoUri, isTest } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  if (!isTest) {
    const { host, name } = mongoose.connection;
    console.log(`[db] connected to ${host}/${name}`);
  }
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.connection.close();
}
