"use client";

import React, { useEffect, useState } from "react";
import { auth, realtimeDb } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get } from "firebase/database";
import { useRouter } from "next/navigation";

type UserDetails = {
  email?: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
};

export default function ProfilePage() {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalScanned, setTotalScanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const router = useRouter();

  const fetchProfile = async (uid: string) => {
    try {
      const userRef = ref(realtimeDb, `Users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        setUserDetails(snapshot.val());
        setError(null);
      } else {
        setError("User profile not found.");
      }
    } catch (e: any) {
      console.error(e);
      setError("You are offline — reconnect to view your profile.");
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotals = async (uid: string) => {
  try {
    const scansRef = ref(realtimeDb, "scannedQRCodes");
    const snapshot = await get(scansRef);
    if (snapshot.exists()) {
      const allScans = snapshot.val();

      // Track unique QR codes per user
      const uniqueQRs = new Map<string, number>(); // qrName -> points

      Object.values(allScans).forEach((scan: any) => {
        if (scan.userId === uid && !uniqueQRs.has(scan.qrName)) {
          uniqueQRs.set(scan.qrName, scan.points || 0);
        }
      });

      // Sum points from unique QR codes
      const points = Array.from(uniqueQRs.values()).reduce((a, b) => a + b, 0);

      setTotalPoints(points);
      setTotalScanned(uniqueQRs.size);
    } else {
      setTotalPoints(0);
      setTotalScanned(0);
    }
  } catch (err) {
    console.error("Failed to fetch totals:", err);
  }
};


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setError("Please log in to view your profile.");
        setLoading(false);
        return;
      }
      fetchProfile(user.uid);
      fetchTotals(user.uid);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      setError(null);
      const user = auth.currentUser;
      if (user) {
        fetchProfile(user.uid);
        fetchTotals(user.uid);
      }
    };
    const onOffline = () => {
      setOffline(true);
      setError("You are offline — reconnect to view your profile.");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleRetry = async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      await fetchProfile(user.uid);
      await fetchTotals(user.uid);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleClose = () => {
    router.push("/map");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );

  if (offline || error)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
        <h2 className="text-2xl font-bold mb-4">Connection Issue</h2>
        <p className="text-center mb-4">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Retry
          </button>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 border border-white rounded-lg hover:bg-white hover:text-black transition"
          >
            Go to Login
          </button>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 border border-white rounded-lg hover:bg-white hover:text-black transition"
          >
            Hard Reload
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-6 sm:p-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Profile</h1>

      <div className="bg-white text-black rounded-xl p-6 sm:p-8 w-full max-w-md shadow-lg flex flex-col items-center">
        {/* Profile Picture */}
        <img
          src={userDetails?.photo || "/images/maskot.png"}
          alt="Profile"
          className="w-32 h-32 rounded-full mb-4 object-cover"
        />

        {/* Name & Email */}
        <h2 className="text-2xl font-semibold mb-1 text-center">
          {userDetails?.firstName} {userDetails?.lastName}
        </h2>
        <p className="text-gray-700 mb-6 text-center">{userDetails?.email}</p>

        {/* Totals */}
        <div className="flex flex-col gap-2 w-full mb-6">
          <div className="flex justify-between text-gray-800 font-bold">
            <span>Total Points:</span>
            <span>{totalPoints}</span>
          </div>
          <div className="flex justify-between text-gray-800 font-bold">
            <span>Total QR Scanned:</span>
            <span>{totalScanned}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full justify-end">
          <button
            onClick={handleLogout}
            className="bg-black text-white px-5 py-2 rounded-lg font-semibold shadow-md hover:bg-white hover:text-black border border-black transition-colors duration-200"
          >
            Logout
          </button>
          <button
            onClick={handleClose}
            className="bg-white text-black px-5 py-2 rounded-lg font-semibold shadow-md hover:bg-black hover:text-white border border-black transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
