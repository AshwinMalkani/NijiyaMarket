import { createContext, useContext } from "react";
import type { User } from "./api";

type AuthValue = {
  user: User;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth used outside AuthContext");
  return value;
}
