import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import NewScreening from "@/pages/NewScreening";
import PatientRegistry from "@/pages/PatientRegistry";
import ClinicalResults from "@/pages/ClinicalResults";
import CareCoordination from "@/pages/CareCoordination";
import Outreach from "@/pages/Outreach";
import Analytics from "@/pages/Analytics";
import PrintSummary from "@/pages/PrintSummary";
import SignInPage from "@/pages/SignInPage";
import ClerkAuthProvider from "@/components/auth/ClerkAuthProvider";
import { Protected } from "@/components/auth/Protected";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <ClerkAuthProvider>
    <div className="bg-atmosphere grain flex min-h-svh flex-col overflow-x-clip text-foreground">
      <Navbar />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1"
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sign-in/*" element={<SignInPage mode="sign-in" />} />
          <Route path="/sign-up/*" element={<SignInPage mode="sign-up" />} />
          <Route path="/new-screening" element={<Protected><NewScreening /></Protected>} />
          <Route path="/patients" element={<Protected><PatientRegistry /></Protected>} />
          <Route path="/patients/:id/print" element={<Protected><PrintSummary /></Protected>} />
          <Route path="/clinical-results" element={<Protected><ClinicalResults /></Protected>} />
          <Route path="/care-coordination" element={<Protected><CareCoordination /></Protected>} />
          <Route path="/outreach" element={<Protected><Outreach /></Protected>} />
          <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
      <Footer />
      <Toaster />
    </div>
    </ClerkAuthProvider>
  );
}
