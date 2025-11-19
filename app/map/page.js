"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { onValue, ref, push } from "firebase/database";
import { auth, realtimeDb } from "../../lib/firebase";
import ProfilePage from "../profile/page";
import "./map.css";
import AuthGuard from "../../components/authGuard";
import { FaQrcode } from "react-icons/fa";

// Prevent SSR errors for Leaflet
const MapWithNoSSR = dynamic(
  () => import("../../components/MapContainerComponent"),
  { ssr: false }
);

export default function Home() {
  const [qrList, setQrList] = useState([]);
  const [selectedQR, setSelectedQR] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const scannerRef = useRef(null);

  // Fetch QR data
  useEffect(() => {
    const qrRef = ref(realtimeDb, "QR-Data");
    const unsubscribe = onValue(qrRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const qrArray = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setQrList(qrArray);
      } else setQrList([]);
    });
    return () => unsubscribe();
  }, []);

  const getUsername = async (uid) => {
    return new Promise((resolve) => {
      const userRef = ref(realtimeDb, `Users/${uid}`);
      onValue(
        userRef,
        (snapshot) => {
          const data = snapshot.val();
          resolve(data?.username || "Unknown User");
        },
        { onlyOnce: true }
      );
    });
  };

  const saveScannedQRCode = async (qrName) => {
    try {
      const user = auth.currentUser;
      const scansRef = ref(realtimeDb, "scannedQRCodes");

      // Prevent duplicate scans for the same user & QR
      const snapshot = await new Promise((resolve) =>
        onValue(scansRef, resolve, { onlyOnce: true })
      );
      const existing = snapshot.val();
      if (
        existing &&
        Object.values(existing).some(
          (scan) =>
            scan.qrName === qrName && scan.userId === (user ? user.uid : "guest")
        )
      ) {
        console.log("QR already scanned by this user.");
        setEarnedPoints(0);
        return;
      }

      let username = "guest";
      if (user) username = await getUsername(user.uid);

      let points = 0;
      if (qrName.includes("_")) {
        const parts = qrName.split("_");
        points = parseInt(parts[parts.length - 1]) || 0;
      } else if (qrName.includes(",")) {
        const parts = qrName.split(",");
        points = parseInt(parts[parts.length - 1].trim()) || 0;
      }

      const now = new Date();
      const date = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      const time = `${hours}:${minutes} ${ampm}`;

      await push(scansRef, {
        qrName,
        userId: user ? user.uid : "guest",
        username,
        date,
        time,
        points,
      });

      setEarnedPoints(points);
      console.log(` Scan saved by ${username}: ${qrName} (${points} pts)`);
    } catch (error) {
      console.error("Error saving scan:", error);
    }
  };

  const startScanner = async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("qr-scanner");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 300 } },
        async (decodedText) => {
          const matchedData = qrList.find(
            (item) => item.id === decodedText || item.name === decodedText
          );
          const qrInfo = matchedData || { id: decodedText, name: decodedText };
          setScannedData(qrInfo);
          await saveScannedQRCode(qrInfo.name || qrInfo.id);
          stopScanner();
        },
        (err) => console.warn("QR Scan Error:", err)
      );
    } catch (err) {
      console.error("Scanner start failed:", err);
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const closeScannedPopup = () => {
    setScannedData(null);
    setEarnedPoints(0);
  };

  return (
    <AuthGuard>
      <div className="map-container">
        {/* Map */}
        <MapWithNoSSR mapData={qrList} selectedQR={selectedQR} />

        {/* Scanner Overlay */}
        {scanning && (
          <div className="scanner-overlay">
            <button onClick={stopScanner} className="scanner-close">
              Close
            </button>
            <div className="scanner-text">
              <h1>Scan QR Code</h1>
            </div>
            <div id="qr-scanner" className="scanner-box" />
          </div>
        )}

        {/* Floating QR Scan + Profile Buttons */}
        {!scanning && !scannedData && (
          <div className="center-btn flex items-center gap-3">
            {/* QR Scanner */}
            <div onClick={startScanner} className="scanner-btn">
              <FaQrcode size={40} color="#fff" />
            </div>

            {/* Profile Button */}
            <Link
              href="/profile"
              className="bg-black text-white px-4 py-2 rounded shadow hover:bg-white hover:text-black transition"
            >
              Profile
            </Link>
          </div>
        )}

        {/* Scanned QR Result Overlay */}
        {scannedData && (
          <div className="result-overlay">
            <div className="result-text">
              <h1>{scannedData.name}</h1>
              {earnedPoints > 0 && (
                <div className="points-display">
                  🎯 You earned <strong>{earnedPoints}</strong> points!
                </div>
              )}
              {scannedData.description && <p>{scannedData.description}</p>}
              {scannedData.picture && (
                <img
                  src={scannedData.picture}
                  alt={scannedData.name}
                  className="result-image"
                />
              )}
              <button onClick={closeScannedPopup} className="view-map-btn">
                View on Map
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
