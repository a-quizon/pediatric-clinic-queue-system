import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue } from "firebase/database";

import { auth } from "../firebase/auth";
import { database } from "../firebase/database";
import { registerFcmTokenForParent, cleanupFcmTokenOnLogout } from "../services/fcmService";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeDB = null;

        const unsubscribeAuth = onAuthStateChanged(
            auth,
            (currentUser) => {
                if (unsubscribeDB) {
                    unsubscribeDB();
                    unsubscribeDB = null;
                }

                if (currentUser) {
                    setUser(currentUser);

                    const userRef = ref(database, `users/${currentUser.uid}`);
                    unsubscribeDB = onValue(userRef, (snapshot) => {
                        if (snapshot.exists()) {
                            let userData = snapshot.val();
                            
                            // Phase 1 Schema Standardization: Auto-initialize missing fields safely
                            let needsUpdate = false;
                            const updates = {};
                            const now = Date.now();
                            
                            if (!userData.status) {
                                userData.status = "active";
                                updates.status = "active";
                                needsUpdate = true;
                            }
                            if (!userData.createdAt) {
                                userData.createdAt = now;
                                updates.createdAt = now;
                                needsUpdate = true;
                            }
                            if (!userData.updatedAt) {
                                userData.updatedAt = now;
                                updates.updatedAt = now;
                                needsUpdate = true;
                            }
                            if (userData.role === "secretary" && !userData.assignedBranch) {
                                userData.assignedBranch = "Angeles"; // Default mandatory branch for existing secretaries
                                updates.assignedBranch = "Angeles";
                                needsUpdate = true;
                            }
                            
                            if (needsUpdate) {
                                // Background save, no need to await so it doesn't block login
                                import("firebase/database").then(({ update, ref }) => {
                                    update(ref(database, `users/${currentUser.uid}`), updates).catch(console.error);
                                });
                            }

                            // Block deactivated users
                            if (userData.status === "inactive") {
                                import("firebase/auth").then(({ signOut }) => {
                                    signOut(auth);
                                });
                                import("react-hot-toast").then(({ toast }) => {
                                    toast.error("This account has been deactivated. Please contact the clinic administrator.");
                                });
                                setLoading(false);
                                return;
                            }

                            const enrichedUser = {
                                ...currentUser,
                                ...userData,
                                uid: currentUser.uid,
                                displayName: userData.name || currentUser?.displayName || userData.fullName,
                                fullName: userData.name || currentUser?.displayName || userData.fullName,
                                name: userData.name || currentUser?.displayName || userData.fullName,
                            };

                            setRole(userData.role);
                            setUser(enrichedUser);

                            if (userData.role === "parent") {
                                registerFcmTokenForParent(enrichedUser).catch(() => {});
                            }

                            console.log("Role:", userData.role);
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error("Database read error in AuthContext:", error);
                        setLoading(false);
                    });
                } else {
                    setUser((prevUser) => {
                        if (prevUser && prevUser.role === "parent") {
                            cleanupFcmTokenOnLogout(prevUser).catch(() => {});
                        }
                        return null;
                    });
                    setRole(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            if (unsubscribeDB) {
                unsubscribeDB();
            }
            unsubscribeAuth();
        };
    }, []);

    const updateContextUser = (updates) => {
        setUser(prev => ({ ...prev, ...updates }));
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                role,
                loading,
                updateContextUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}