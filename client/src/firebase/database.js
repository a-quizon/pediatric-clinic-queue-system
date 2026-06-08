import app from "./firebaseConfig";
import { getDatabase } from "firebase/database";

export const database = getDatabase(app);