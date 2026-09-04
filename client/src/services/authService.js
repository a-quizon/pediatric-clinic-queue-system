import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification, deleteUser } from "firebase/auth";
import { ref, set, update, get } from "firebase/database";

import { auth } from "../firebase/auth";
import { database } from "../firebase/database";
import { cleanupPushSubscriptionOnLogout } from "./pushService";
import { closeActiveReservationsForParent } from "./reservationService";

let accountLifecycleInProgress = false;

export const isAccountLifecycleInProgress = () => accountLifecycleInProgress;

export const canParentSelfReactivate = (userData) => (
  Boolean(userData)
  && userData.role === "parent"
  && userData.status === "inactive"
  && userData.deactivationSource === "self"
  && userData.isDeleted !== true
);

export const getParentPostAuthPath = (userData, firebaseUser) => {
  if (firebaseUser && !firebaseUser.emailVerified) return "/verify-email";
  if (userData?.onboardingComplete === false) return "/onboarding/child";
  return "/parent";
};

export const reactivateSelfDeactivatedParent = async (uid) => {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    status: "active",
    deactivationSource: null,
    updatedAt: Date.now()
  });
};

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

    // Temporarily store phone number for when they verify their email
    if (phone) {
      localStorage.setItem(`pending_registration_${user.uid}`, JSON.stringify({ phone }));
    }

    try {
      await sendEmailVerification(user);
    } catch (err) {
      console.error("Could not send verification email:", err);
      throw { code: 'auth/verification-email-failed', originalError: err };
    }

  return user;
};

export const completeParentRegistration = async (user) => {
  const userRef = ref(database, `users/${user.uid}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return; // Profile already created
  }

  const pendingData = JSON.parse(localStorage.getItem(`pending_registration_${user.uid}`) || "{}");
  const now = Date.now();
  
  await set(userRef, {
    uid: user.uid,
    name: user.displayName || "Parent",
    email: user.email,
    phone: pendingData.phone || "",
    role: "parent",
    status: "active",
    onboardingComplete: false,
    inAppNotificationsEnabled: true,
    createdAt: now,
    updatedAt: now
  });
  
  localStorage.removeItem(`pending_registration_${user.uid}`);
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

const PUSH_CLEANUP_TIMEOUT_MS = 4000;

export const logoutUser = async (user) => {
  try {
    if (user && user.role === "parent") {
      await Promise.race([
        cleanupPushSubscriptionOnLogout(user),
        new Promise((resolve) => setTimeout(resolve, PUSH_CLEANUP_TIMEOUT_MS)),
      ]);
    }
  } catch (error) {
    console.error("Push cleanup on logout failed:", error);
  }
  await signOut(auth);
};

export const updateUserProfile = async (uid, data) => {
  if (!uid || !data) return;
  const updates = { updatedAt: Date.now() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.contactNumber !== undefined) updates.contactNumber = data.contactNumber;
  if (data.professionalTitle !== undefined) updates.professionalTitle = data.professionalTitle;
  if (data.clinicName !== undefined) updates.clinicName = data.clinicName;

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

export const completeParentOnboarding = async (uid) => {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    onboardingComplete: true,
    updatedAt: Date.now()
  });
};

export const deactivateOwnAccount = async (user) => {
  const uid = user?.uid || auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated.");

  accountLifecycleInProgress = true;
  try {
    await closeActiveReservationsForParent(uid, {
      terminalStatus: "cancelled",
      reason: "Parent deactivated their account."
    });
    await update(ref(database, `users/${uid}`), {
      status: "inactive",
      deactivationSource: "self",
      updatedAt: Date.now()
    });
    await logoutUser(user || { uid, role: "parent" });
  } finally {
    accountLifecycleInProgress = false;
  }
};

export const softDeleteOwnAccount = async (password, user) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) throw new Error("User not authenticated.");
  if (!password) throw new Error("Password is required.");

  accountLifecycleInProgress = true;
  try {
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    await closeActiveReservationsForParent(currentUser.uid, {
      terminalStatus: "forfeited",
      reason: "Parent account was deleted."
    });

    await update(ref(database, `users/${currentUser.uid}`), {
      isDeleted: true,
      deletedAt: Date.now(),
      status: "inactive",
      deactivationSource: "self",
      updatedAt: Date.now()
    });

    try {
      await cleanupPushSubscriptionOnLogout(user || { uid: currentUser.uid, role: "parent" });
    } catch (error) {
      console.error("Push cleanup on account delete failed:", error);
    }

    await deleteUser(currentUser);
    try {
      await signOut(auth);
    } catch {
      // Session is already invalid after deleteUser.
    }
  } finally {
    accountLifecycleInProgress = false;
  }
};