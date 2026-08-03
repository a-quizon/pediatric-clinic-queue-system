import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { ref, set, update } from "firebase/database";

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

    const now = Date.now();
    await set(
    ref(database, `users/${user.uid}`),
        {
            uid: user.uid,
            name,
            email,
            phone,
            role: "parent",
            status: "active",
            createdAt: now,
            updatedAt: now
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

export const updateUserProfile = async (uid, data) => {
  if (!uid || !data) return;
  const updates = { updatedAt: Date.now() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;

  // Update Realtime Database
  await update(ref(database, `users/${uid}`), updates);

  // Update Auth Profile
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === uid && data.name) {
    await updateProfile(currentUser, { displayName: data.name });
  }
};

export const changeUserPassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("User not authenticated.");

  // Re-authenticate
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  // Update password
  await updatePassword(user, newPassword);
};