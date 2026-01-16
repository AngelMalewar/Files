import React, { createContext, useState, useEffect, useContext } from 'react';
import uuid from 'react-native-uuid';
import { supabase } from '../config/database'; // Assuming this path is correct

const AppContext = createContext();
export const useApp = () => useContext(AppContext);


export const AppProvider = ({ children }) => {
  // 1. UPDATED STATE: Use Supabase session and user state, and add loading state
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null); // The Supabase User object
  const [isLoadingSession, setIsLoadingSession] = useState(true); // CRITICAL: Indicates if session check is ongoing
  // 🚨 NEW STATE: Persistent Premium Status
  const [isPremiumStatus, setIsPremiumStatus] = useState(false);

  // Existing States
  const [businesses, setBusinesses] = useState([]);
  const [ads, setAds] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // --- NEW FUNCTION: Fetch User Profile Data (Premium Status) ---
  const loadUserProfileData = async (userId) => {
    if (!userId) {
      setIsPremiumStatus(false);
      return;
    }


    try {
      // Fetch the is_premium status from the profiles table
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle for robustness against initial sign-up delay

      if (error && error.code !== 'PGRST116') {
        console.error("Error loading user profile:", error);
        setIsPremiumStatus(false);
        return;
      }

      // Update state based on fetched profile data
      setIsPremiumStatus(profile?.is_premium || false);

    } catch (e) {
      console.error("Profile fetch exception:", e);
      setIsPremiumStatus(false);
    }
  };
  // --- END NEW PROFILE LOGIC ---


  // --- Supabase Session Listener (MODIFIED) ---
  useEffect(() => {
    const handleSession = (authSession) => {
      setSession(authSession);
      const currentUser = authSession?.user || null;
      setUser(currentUser);
      setIsLoadingSession(false);

      // 🚨 CRITICAL: Load premium status whenever session/user changes
      if (currentUser?.id) {
        loadUserProfileData(currentUser.id);
      } else {
        setIsPremiumStatus(false);
      }
    };

    // Initial check for session
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      handleSession(authSession);
    }).catch(() => {
      handleSession(null);
    });

    // Set up listener for future auth state changes
    const authResponse = supabase.auth.onAuthStateChange(
      (event, authSession) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setIsLoadingSession(true);
        }
        handleSession(authSession);
      }
    );

    const listener = authResponse?.data;

    // Cleanup the listener on unmount
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);
  // --- END MODIFIED AUTH LOGIC ---


  // 2. AUTHENTICATION FUNCTIONS
  const login = async (email, password) => {
    setIsLoadingSession(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error("Supabase Login Error:", error);
        throw error;
      }
      // Session and profile data updated by the listener above
      return { success: true };
    } catch (error) {
      setIsLoadingSession(false);
      return { success: false, error: error.message };
    }
  };

  // --- NEW FUNCTION: Google Sign-In ---
  const signInWithGoogle = async () => {
    setIsLoadingSession(true);
    try {
      // Initiates the Google OAuth flow. Supabase handles the session creation 
      // after the user completes the sign-in via the web browser/Expo flow.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // NOTE: For Expo/React Native, we do not need to explicitly set a `redirectTo` 
        // if you are using the Supabase "Web application" provider configured with the 
        // correct Expo deep link URI in the Google Cloud Console.
        options: {
          // You can add 'redirectTo' here if necessary for specific environments, 
          // e.g., for `exp://...` or custom scheme, but typically Supabase handles it.
        }
      });

      if (error) {
        console.error("Supabase Google Login Error:", error);
        throw error;
      }
      // The listener handles setting the session after successful redirect/auth flow.
      return { success: true };
    } catch (error) {
      setIsLoadingSession(false);
      return { success: false, error: error.message };
    }
  };
  // --- END NEW FUNCTION ---

  const logout = async () => {
    setIsLoadingSession(true);
    try {
      await supabase.auth.signOut();
      // Profile status is reset to false by the listener
    } catch (e) {
      console.error("Supabase Logout Error:", e);
    }
  };
  // --- END AUTHENTICATION FUNCTIONS ---


  // --- EXISTING FUNCTIONS (Preserved) ---
  const uploadMedia = async (uri, path) => {
    console.warn("Supabase Storage: uploadMedia logic needs implementation.");
    return `https://mock-url.com/${path}`;
  };

  const addBusiness = async (businessData) => {
    // ... (Your existing addBusiness logic, preserved)
    try {
      // 🚨 PROTECTION: Prevent non-premium users from adding a business
      if (!isPremiumStatus) {
        throw new Error("Only premium members can add a business.");
      }

      let uploadedImages = [];
      for (let i = 0; i < businessData.images.length; i++) {
        const url = await uploadMedia(
          businessData.images[i],
          `businesses/${Date.now()}/image_${i}.jpg`
        );
        uploadedImages.push(url);
      }

      let uploadedVideo = null;
      if (businessData.video) {
        uploadedVideo = await uploadMedia(
          businessData.video,
          `businesses/${Date.now()}/video.mp4`
        );
      }

      const businessId = uuid.v4();

      const payload = {
        id: businessId.toString(),
        name: businessData.name,
        category: businessData.category,
        owner_name: businessData.ownerName,
        phone: businessData.phone,
        description: businessData.description || "",
        reference_id: businessData.referenceId || "",
        images: uploadedImages,
        video: uploadedVideo,
        owner_id: user?.id || null,
        created_at: new Date().toISOString()
      };

      // ⭐ ACTUAL INSERT INTO SUPABASE
      const { error } = await supabase
        .from('businesses')
        .insert([payload]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.log("ADD BUSINESS ERROR:", error);
      return { success: false, error };
    }
  };

  const updateBusiness = (businessId, updates) => {
    setBusinesses(businesses.map(b =>
      b.id === businessId ? { ...b, ...updates } : b
    ));
  };


  // NOTE: This addAd function is for mock data only.
  const addAd = (adData) => {
    const newAd = {
      id: Date.now().toString(),
      ...adData,
      created_at: new Date(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };
    setAds([...ads, newAd]);
  };

  // NOTE: This deleteAd function is for mock data only.
  const deleteAd = (adId) => {
    setAds(ads.filter(a => a.id !== adId));
  };

  // 🚨 MODIFIED: isPremium now returns the state loaded from the profiles table
  const isPremium = () => {
    return isPremiumStatus;
  };

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('owner_id, name, category, description, address, latitude, longitude, image_urls, video_url, working_hours, supports_home_delivery'); // <-- FIX: ADDED supports_home_delivery

      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }
      console.log("Supabase Raw Data Example:", data[0]);

      return data;

    } catch (e) {
      console.error('Error fetching businesses:', e);
      return [];
    }
  };

  return (
    <AppContext.Provider value={{
      // NEW EXPORTED VALUES
      session,
      user,
      isLoadingSession,

      // 🚨 NEW AUTH FUNCTIONS
      login,
      signInWithGoogle, // <-- NEWLY ADDED
      logout,

      // 🚨 EXPORT NEW STATE
      isPremium,

      // EXISTING EXPORTED VALUES
      businesses, setBusinesses, addBusiness, updateBusiness,
      ads, addAd, deleteAd,
      userLocation, setUserLocation,
      fetchBusinesses
    }}>
      {children}
    </AppContext.Provider>
  );
};