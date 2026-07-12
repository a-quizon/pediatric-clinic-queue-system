import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";

import { auth } from "../firebase/auth";
import { database } from "../firebase/database";
import { registerFcmTokenForParent, cleanupFcmTokenOnLogout } from "../services/fcmService";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(
            auth,
            async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);

                    try {
                        const snapshot = await get(
                            ref(database, `users/${currentUser.uid}`)
                        );

                        if (snapshot.exists()) {
                            const userData = snapshot.val();
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
                    } catch (error) {
                        console.error(error);
                    }
                } else {
                    setUser((prevUser) => {
                        if (prevUser && prevUser.role === "parent") {
                            cleanupFcmTokenOnLogout(prevUser).catch(() => {});
                        }
                        return null;
                    });
                    setRole(null);
                }

                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                role,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}