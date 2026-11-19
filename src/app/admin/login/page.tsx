import { AdminAuthLayout } from "@/components/admin-auth/admin-auth-layout";
import { AdminLoginForm } from "@/components/admin-auth/admin-login-form";

export default function AdminLoginPage() {
  return (
    <AdminAuthLayout>
      <AdminLoginForm />
    </AdminAuthLayout>
  );
}
