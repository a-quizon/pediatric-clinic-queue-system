import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set } from "firebase/database";

import { auth } from "../firebase/auth";
import { database } from "../firebase/database";
import { cleanupFcmTokenOnLogout } from "./fcmService";

export const registerUser = async (
  name,
  email,
  phone,
  password
) => {
  const userCredential =
    await createUserWithEmailAndPassword(
        auth,
        email,
        password
    );

    const user = userCredential.user;
    if (name) {
      await updateProfile(user, { displayName: name }).catch(err => console.error("Could not update profile:", err));
    }

    console.log("User created:", user.uid);

    await set(
    ref(database, `users/${user.uid}`),
        {
            uid: user.uid,
            name,
            email,
            phone,
            role: "parent"
        }
    );

    console.log("Saved successfully!");

  return user;
};

export const loginUser = async (
  email,
  password
) => {

  const userCredential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  return userCredential.user;
};

export const logoutUser = async (user) => {
  if (user && user.role === "parent") {
    await cleanupFcmTokenOnLogout(user);
  }
  await signOut(auth);
};