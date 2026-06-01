import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Pricing from "./pages/Pricing.tsx";
import Organizations from "./pages/Organizations.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import AuditLog from "./pages/AuditLog.tsx";
import OrgSso from "./pages/OrgSso.tsx";
import { OrganizationsProvider } from "@/hooks/useOrganizations";
import Dashboard from "./pages/Dashboard.tsx";
import Research from "./pages/Research.tsx";
import Decide from "./pages/Decide.tsx";
import Litigation from "./pages/Litigation.tsx";
import Intake from "./pages/Intake.tsx";
import Diligence from "./pages/Diligence.tsx";
import Matters from "./pages/Matters.tsx";
import MatterDetail from "./pages/MatterDetail.tsx";
import Drafts from "./pages/Drafts.tsx";
import DraftEditor from "./pages/DraftEditor.tsx";
import Settings from "./pages/Settings.tsx";
import Legal from "./pages/Legal.tsx";
import Features from "./pages/Features.tsx";
import Post from "./pages/Post.tsx";
import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminCustomers from "./pages/admin/AdminCustomers.tsx";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions.tsx";
import AdminPayments from "./pages/admin/AdminPayments.tsx";
import AdminPages from "./pages/admin/AdminPages.tsx";
import AdminPosts from "./pages/admin/AdminPosts.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OrganizationsProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/legal/:slug" element={<Legal />} />
            <Route path="/features" element={<Features />} />
            <Route path="/features/:slug" element={<Features />} />
            <Route path="/posts/:slug" element={<Post />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/app/organizations" element={<ProtectedRoute><Organizations /></ProtectedRoute>} />
            <Route path="/app/organizations/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
            <Route path="/app/organizations/sso" element={<ProtectedRoute><OrgSso /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/research" element={<ProtectedRoute><Research /></ProtectedRoute>} />
            <Route path="/app/decide" element={<ProtectedRoute><Decide /></ProtectedRoute>} />
            <Route path="/app/litigation" element={<ProtectedRoute><Litigation /></ProtectedRoute>} />
            <Route path="/app/intake" element={<ProtectedRoute><Intake /></ProtectedRoute>} />
            <Route path="/app/diligence" element={<ProtectedRoute><Diligence /></ProtectedRoute>} />
            <Route path="/app/matters" element={<ProtectedRoute><Matters /></ProtectedRoute>} />
            <Route path="/app/matters/:id" element={<ProtectedRoute><MatterDetail /></ProtectedRoute>} />
            <Route path="/app/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/app/drafts/:id" element={<ProtectedRoute><DraftEditor /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminOverview /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/customers" element={<ProtectedRoute><AdminRoute><AdminCustomers /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute><AdminRoute><AdminSubscriptions /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute><AdminRoute><AdminPayments /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/pages" element={<ProtectedRoute><AdminRoute><AdminPages /></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/posts" element={<ProtectedRoute><AdminRoute><AdminPosts /></AdminRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </OrganizationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
