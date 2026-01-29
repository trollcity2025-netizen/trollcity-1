import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import TMVDrivingManual from "./components/tmv/TMVDrivingManual";
import DriversTest from "./components/tmv/DriversTest";

export default function TMVRouter() {
  // Only show manual if not acknowledged
  const seen = typeof window !== 'undefined' && localStorage.getItem('tmv_driving_manual_acknowledged');
  return (
    <Router>
      <Routes>
        <Route path="/tmv/manual" element={<TMVDrivingManual />} />
        <Route path="/tmv/test" element={seen ? <DriversTest onComplete={() => { window.location.href = '/tmv/manual'; }} /> : <Navigate to="/tmv/manual" />} />
        {/* Add more TMV routes as needed */}
      </Routes>
    </Router>
  );
}
