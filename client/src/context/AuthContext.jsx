import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";

import { auth } from "../firebase/auth";
import { database } from "../firebase/database";

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

                            setRole(userData.role);

                            console.log("Role:", userData.role);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                } else {
                    setUser(null);
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