import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import { ProtectedRoute, AdminRoute } from '@/components/shared/ProtectedRoute';
import Toaster from '@/components/shared/Toaster';

import Login from '@/pages/auth/Login';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/admin/Dashboard';
import Equipment from '@/pages/admin/Equipment';
import Users from '@/pages/admin/Users';
import Sectors from '@/pages/admin/Sectors';
import EquipmentTypes from '@/pages/admin/EquipmentTypes';
import EquipmentModels from '@/pages/admin/EquipmentModels';
import AuditLog from '@/pages/admin/AuditLog';
import MyEquipment from '@/pages/user/MyEquipment';
import Profile from '@/pages/user/Profile';

function RootRedirect() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/meus-equipamentos'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />

        <Route element={<AdminRoute />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/equipment" element={<Equipment />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/sectors" element={<Sectors />} />
          <Route path="/admin/equipment-types" element={<EquipmentTypes />} />
          <Route path="/admin/equipment-models" element={<EquipmentModels />} />
          <Route path="/admin/audit-log" element={<AuditLog />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/meus-equipamentos" element={<MyEquipment />} />
          <Route path="/perfil" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>

      <Toaster />
    </BrowserRouter>
  );
}
