import { createContext, useContext, createEffect, createSignal, ParentComponent, onCleanup } from "solid-js";
import { supabase } from "../lib/supabase";
import { Session, User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  full_name: string;
  roles: string[];
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  const [session, setSession] = createSignal<Session | null>(null);
  const [user, setUser] = createSignal<User | null>(null);
  const [profile, setProfile] = createSignal<UserProfile | null>(null);
  const [loading, setLoading] = createSignal<boolean>(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
        
      if (profileError) throw profileError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);
        
      if (rolesError) throw rolesError;

      const roles = rolesData.map((r: any) => r.roles.name);

      setProfile({
        id: userId,
        full_name: profileData?.full_name || "",
        roles
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    }
  };

  createEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        await fetchProfile(session.user.id);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    onCleanup(() => {
      authListener.subscription.unsubscribe();
    });
  });

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      get session() { return session(); },
      get user() { return user(); },
      get profile() { return profile(); },
      get loading() { return loading(); },
      logout
    }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
