import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { firebaseConfig } from "../firebase/firebaseConfig";
import { database } from "../firebase/database";
import { auth } from "../firebase/auth";

export const getActiveDoctor = async () => {
  const snapshot = await get(ref(database, "users"));
  if (!snapshot.exists()) return null;
  const users = Object.values(snapshot.val());
  return users.find(u => u.role === "doctor" && u.status === "active");
};

export const createStaffAccount = async (staffData) => {
  // staffData: { role, name, email, phone, password, assignedBranch (optional for doctor) }
  
  if (staffData.role === "doctor") {
    const activeDoctor = await getActiveDoctor();
    if (activeDoctor) {
      throw new Error("Only one active Doctor account is allowed. Please deactivate the current Doctor before creating a new one.");
    }
  }

  // Create a secondary app to avoid logging out the current Admin
  const secondaryAppName = "SecondaryAppInstance";
  let secondaryApp;
  
  const existingApps = getApps();
  const existingSecondary = existingApps.find(app => app.name === secondaryAppName);
  
  if (existingSecondary) {
    secondaryApp = existingSecondary;
  } else {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }

  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      staffData.email,
      staffData.password
    );

    const user = userCredential.user;

    // Update Auth Profile
    if (staffData.name) {
      await updateProfile(user, { displayName: staffData.name }).catch(err => console.error("Could not update profile:", err));
    }

    // Save user details to Realtime Database
    const now = Date.now();
    const dbPayload = {
      uid: user.uid,
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone || "",
      role: staffData.role,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    if (staffData.role === "secretary") {
      dbPayload.assignedBranch = staffData.assignedBranch;
    }

    await set(ref(database, `users/${user.uid}`), dbPayload);

    // Sign out from the secondary app instance
    await signOut(secondaryAuth);
    
    // Delete the secondary app instance to clean up
    await deleteApp(secondaryApp);

    return user;
  } catch (error) {
    // Clean up on error as well
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth).catch(() => {});
    }
    await deleteApp(secondaryApp).catch(() => {});
    throw error;
  }
};

export const updateUser = async (uid, updates) => {
  const userRef = ref(database, `users/${uid}`);
  const payload = {
    ...updates,
    updatedAt: Date.now()
  };
  
  const { update } = await import("firebase/database");
  return update(userRef, payload);
};

export const toggleUserStatus = async (uid, currentStatus) => {
  const userRef = ref(database, `users/${uid}`);
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  
  const { update } = await import("firebase/database");
  await update(userRef, { status: newStatus, updatedAt: Date.now() });
  
  return newStatus;
};

export const sendAdminPasswordResetEmail = async (email) => {
  return sendPasswordResetEmail(auth, email);
};
