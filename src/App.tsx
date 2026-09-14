import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ThemeProvider } from '@/theme/themeProvider';
import { Layout } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { LoginScreen } from '@/screens/LoginScreen';
import { OverviewScreen } from '@/screens/OverviewScreen';
import { ErrorsScreen } from '@/screens/ErrorsScreen';
import { PlatformScreen } from '@/screens/PlatformScreen';
import { ApprovalQueueScreen } from '@/screens/marketing/ApprovalQueueScreen';
import { PublicationsScreen } from '@/screens/marketing/PublicationsScreen';
import { ActivityScreen } from '@/screens/marketing/ActivityScreen';
import { ReferenceScreen } from '@/screens/marketing/ReferenceScreen';
import { CharterScreen } from '@/screens/marketing/CharterScreen';
import { ListeningScreen } from '@/screens/marketing/ListeningScreen';

function Gate() {
  const { state } = useAuth();
  if (state.status === 'loading') return <div className="p-10"><Spinner label="Checking session…" /></div>;
  if (state.status === 'signed-out') return <LoginScreen />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewScreen />} />
        <Route path="errors" element={<ErrorsScreen />} />
        <Route path="platform" element={<PlatformScreen />} />
        <Route path="marketing" element={<ApprovalQueueScreen />} />
        <Route path="marketing/publications" element={<PublicationsScreen />} />
        <Route path="marketing/activity" element={<ActivityScreen />} />
        <Route path="marketing/listening" element={<ListeningScreen />} />
        <Route path="marketing/reference" element={<ReferenceScreen />} />
        <Route path="marketing/charter" element={<CharterScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
