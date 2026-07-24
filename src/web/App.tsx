import { useEffect, useMemo, useState } from "react";
import { api, type User } from "./lib/api";
import { AuthContext } from "./lib/auth";
import { RouterProvider, match, useRouter } from "./lib/router";
import { TabBar } from "./components/TabBar";
import { Login } from "./pages/Login";
import { Feed } from "./pages/Feed";
import { Rankings } from "./pages/Rankings";
import { Add } from "./pages/Add";
import { Rate } from "./pages/Rate";
import { Item } from "./pages/Item";
import { Profile } from "./pages/Profile";

export function App() {
  // undefined = still checking the session cookie
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  const auth = useMemo(() => (user ? { user, setUser } : null), [user]);

  if (user === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="animate-pulse text-4xl">🍙</span>
      </div>
    );
  }

  if (!auth) return <Login onSignedIn={setUser} />;

  return (
    <AuthContext.Provider value={auth}>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </AuthContext.Provider>
  );
}

function Routes() {
  const { path } = useRouter();

  const item = match("/item/:id", path);
  if (item) return <Item itemId={Number(item.id)} />;

  const rate = match("/rate/:id", path);
  if (rate) return <Rate itemId={Number(rate.id)} />;

  const person = match("/user/:id", path);
  if (person) return <WithTabs><Profile userId={Number(person.id)} /></WithTabs>;

  if (path === "/add") return <Add />;
  if (path === "/rankings") return <WithTabs><Rankings /></WithTabs>;
  if (path === "/profile") return <WithTabs><Profile /></WithTabs>;

  return (
    <WithTabs>
      <Feed />
    </WithTabs>
  );
}

function WithTabs({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
