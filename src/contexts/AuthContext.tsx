import { useRouter } from "next/router";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { setCookie, parseCookies, destroyCookie } from "nookies";
import { api } from "../services/apiClient";

type User = {
  email: string;
  permissions: string[];
  roles: string[];
};

type SignInCredentials = {
  email: string;
  password: string;
};

type AuthContextData = {
  signIn(credentials: SignInCredentials): Promise<void>;
  user: User;
  isAuthenticated: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext({} as AuthContextData);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User>();

  const router = useRouter();

  const isAuthenticated = !!user;

  async function signIn({ email, password }) {
    try {
      const response = await api.post("sessions", {
        email,
        password,
      });

      const { token, refreshToken, permissions, roles } = response.data;

      setCookie(undefined, "authPractice.token", token, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      setCookie(undefined, "authPractice.refreshToken", refreshToken, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      setUser({
        email,
        permissions,
        roles,
      });

      api.defaults.headers["Authorization"] = `Bearer ${token}`;

      router.push("/dashboard");
    } catch (err) {
      console.log(err);
    }
  }

  useEffect(() => {
    const { "authPractice.token": token } = parseCookies();

    if (token) {
      api
        .get("/me")
        .then((response) => {
          const { email, permissions, roles } = response.data;

          setUser({ email, permissions, roles });
        })
        .catch(() => {
          destroyCookie(undefined, "authPractice.token");
          destroyCookie(undefined, "authPractice.refreshToken");

          router.push("/");
        });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ signIn, user, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
